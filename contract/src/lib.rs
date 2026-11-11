//! Testnet NEAR escrow. No admin withdrawals, upgrades, or mainnet path.
use near_sdk::collections::LookupMap;
use near_sdk::json_types::{U128, U64};
use near_sdk::{env, near, AccountId, Gas, NearToken, PanicOnDefault, Promise, PromiseOrValue};

const STORAGE_FEE: u128 = 100_000_000_000_000_000_000_000; // 0.1 NEAR, retained
const CALLBACK_GAS: Gas = Gas::from_tgas(15);
mod policy;
pub use policy::Status;

#[near(serializers = [borsh, json])]
#[derive(Clone)]
pub struct Bid {
    pub worker: AccountId,
    pub amount: U128,
}

#[near(serializers = [borsh, json])]
#[derive(Clone)]
pub struct Task {
    pub client: AccountId,
    pub worker: Option<AccountId>,
    pub verifier: AccountId,
    pub title: String,
    pub criteria: String,
    /// Immutable ceiling. The accepted bid determines escrow_amount.
    pub budget: U128,
    pub escrow_amount: U128,
    pub bids: Vec<Bid>,
    pub deadline_ns: U64,
    pub evidence_sha256: Option<String>,
    pub status: Status,
}

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct Escrow {
    tasks: LookupMap<u64, Task>,
    next_id: u64,
}

#[near]
impl Escrow {
    #[init]
    pub fn new() -> Self {
        Self::testnet(&env::current_account_id());
        Self {
            tasks: LookupMap::new(b"t"),
            next_id: 0,
        }
    }

    /// Publish immutable terms. Attach exactly storage_fee(), not the budget.
    /// This retained fee reserves storage for all eight bids and later evidence.
    #[payable]
    pub fn post(
        &mut self,
        verifier: AccountId,
        title: String,
        criteria: String,
        budget: U128,
        deadline_ns: U64,
    ) -> U64 {
        let client = env::predecessor_account_id();
        Self::testnet(&client);
        Self::testnet(&verifier);
        assert!(
            policy::valid_post_roles(
                client.as_str(),
                verifier.as_str(),
                env::current_account_id().as_str()
            ),
            "Distinct roles and contract required"
        );
        assert!(
            policy::valid_post_terms(
                &title,
                &criteria,
                budget.0,
                env::block_timestamp(),
                deadline_ns.0
            ),
            "Invalid task terms"
        );
        assert_eq!(
            env::attached_deposit().as_yoctonear(),
            STORAGE_FEE,
            "Attach storage fee exactly"
        );
        let id = self.next_id;
        self.next_id = id.checked_add(1).expect("ID overflow");
        let before = env::storage_usage();
        self.tasks.insert(
            &id,
            &Task {
                client,
                worker: None,
                verifier,
                title,
                criteria,
                budget,
                escrow_amount: U128(0),
                bids: vec![],
                deadline_ns,
                evidence_sha256: None,
                status: Status::Posted,
            },
        );
        // Each future bid needs at most 4 + 64 + 16 bytes. The extra 256
        // reserves the selected worker, evidence, and serialized-state growth.
        let reserve = policy::MAX_BIDS as u64 * 84 + 256;
        let storage = u128::from(env::storage_usage().saturating_sub(before) + reserve)
            .checked_mul(env::storage_byte_cost().as_yoctonear())
            .unwrap();
        assert!(STORAGE_FEE >= storage, "Storage fee insufficient");
        Self::event(id, "posted");
        U64(id)
    }

    /// One immutable bid per worker, at most eight per task, paid by post storage.
    pub fn bid(&mut self, task_id: U64, amount: U128) {
        let mut t = self.load(task_id.0);
        let worker = env::predecessor_account_id();
        Self::testnet(&worker);
        assert!(
            policy::can_bid(
                worker.as_str(),
                t.client.as_str(),
                t.verifier.as_str(),
                env::current_account_id().as_str(),
                &t.status,
                env::block_timestamp(),
                t.deadline_ns.0,
                amount.0,
                t.budget.0,
                t.bids.iter().any(|b| b.worker == worker),
                t.bids.len()
            ),
            "Bid denied"
        );
        t.bids.push(Bid { worker, amount });
        self.tasks.insert(&task_id.0, &t);
        Self::event(task_id.0, "bid");
    }

    /// Only the posting client may select an existing bid and fund it once.
    #[payable]
    pub fn escrow(&mut self, task_id: U64, worker: AccountId) {
        let mut t = self.load(task_id.0);
        let amount = t
            .bids
            .iter()
            .find(|b| b.worker == worker)
            .map(|b| b.amount.0);
        assert!(
            policy::can_escrow(
                env::predecessor_account_id().as_str(),
                t.client.as_str(),
                &t.status,
                env::block_timestamp(),
                t.deadline_ns.0,
                amount,
                env::attached_deposit().as_yoctonear()
            ),
            "Escrow denied"
        );
        t.worker = Some(worker);
        t.escrow_amount = U128(amount.expect("Existing bid required"));
        t.status = Status::Open;
        self.tasks.insert(&task_id.0, &t);
        Self::event(task_id.0, "escrowed");
    }

    pub fn deliver(&mut self, task_id: U64, evidence_sha256: String) {
        let mut t = self.load(task_id.0);
        assert!(
            policy::can_deliver(
                env::predecessor_account_id().as_str(),
                t.worker.as_ref().map(|worker| worker.as_str()),
                &t.status,
                env::block_timestamp(),
                t.deadline_ns.0
            ),
            "Delivery denied"
        );
        assert!(
            evidence_sha256.len() == 64
                && evidence_sha256
                    .bytes()
                    .all(|b| b.is_ascii_hexdigit() && !b.is_ascii_uppercase()),
            "Expected lowercase SHA-256"
        );
        t.evidence_sha256 = Some(evidence_sha256);
        t.status = Status::Delivered;
        self.tasks.insert(&task_id.0, &t);
        Self::event(task_id.0, "delivered");
    }

    /// Named verifier approval is final. Failed transfers preserve the worker claim.
    pub fn release(&mut self, task_id: U64) -> Promise {
        Self::payout_gas();
        let mut t = self.load(task_id.0);
        assert!(
            policy::can_release(
                env::predecessor_account_id().as_str(),
                t.verifier.as_str(),
                &t.status,
                env::block_timestamp(),
                t.deadline_ns.0
            ),
            "Release denied"
        );
        t.status = Status::Approved;
        self.tasks.insert(&task_id.0, &t);
        Self::event(task_id.0, "approved");
        self.pay(task_id)
    }

    /// Anyone may refund expired unfunded or unapproved work. Funded budgets
    /// always return to the posting client; the retained storage fee is excluded.
    pub fn refund(&mut self, task_id: U64) -> PromiseOrValue<bool> {
        let mut t = self.load(task_id.0);
        assert!(
            policy::can_refund(&t.status, env::block_timestamp(), t.deadline_ns.0),
            "Refund denied"
        );
        if t.status == Status::Posted {
            t.status = Status::Cancelled;
            self.tasks.insert(&task_id.0, &t);
            Self::event(task_id.0, "cancelled");
            return PromiseOrValue::Value(true);
        }
        Self::payout_gas();
        t.status = Status::Refundable;
        self.tasks.insert(&task_id.0, &t);
        Self::event(task_id.0, "expired");
        PromiseOrValue::Promise(self.pay(task_id))
    }

    /// Permissionless retry. No caller can change the beneficiary or amount.
    pub fn pay(&mut self, task_id: U64) -> Promise {
        Self::payout_gas();
        let mut t = self.load(task_id.0);
        let recipient = match t.status {
            Status::Approved => {
                t.status = Status::PayingWorker;
                t.worker.clone().expect("No selected worker")
            }
            Status::Refundable => {
                t.status = Status::Refunding;
                t.client.clone()
            }
            _ => env::panic_str("No payable balance"),
        };
        self.tasks.insert(&task_id.0, &t);
        Self::event(task_id.0, "transfer_started");
        Promise::new(recipient)
            .transfer(NearToken::from_yoctonear(t.escrow_amount.0))
            .then(
                Self::ext(env::current_account_id())
                    .with_static_gas(CALLBACK_GAS)
                    .on_paid(task_id),
            )
    }

    #[private]
    pub fn on_paid(&mut self, task_id: U64) -> bool {
        assert_eq!(env::promise_results_count(), 1, "One result required");
        let mut t = self.load(task_id.0);
        // A native transfer has an empty result. Bound result reads to zero bytes.
        let ok = env::promise_result_checked(0, 0).is_ok();
        t.status = policy::receipt_status(&t.status, ok).expect("No transfer pending");
        self.tasks.insert(&task_id.0, &t);
        Self::event(
            task_id.0,
            if ok {
                "transfer_succeeded"
            } else {
                "transfer_failed"
            },
        );
        ok
    }

    pub fn get_task(&self, task_id: U64) -> Option<Task> {
        self.tasks.get(&task_id.0)
    }
    pub fn task_count(&self) -> U64 {
        U64(self.next_id)
    }
    pub fn storage_fee(&self) -> U128 {
        U128(STORAGE_FEE)
    }
    pub fn max_bids(&self) -> u32 {
        policy::MAX_BIDS as u32
    }
}

impl Escrow {
    fn load(&self, id: u64) -> Task {
        self.tasks.get(&id).expect("Unknown task")
    }
    fn testnet(id: &AccountId) {
        assert!(
            id.as_str().ends_with(".testnet"),
            "Testnet named accounts only"
        );
    }
    fn payout_gas() {
        assert!(
            policy::payout_gas(env::prepaid_gas().as_gas(), env::used_gas().as_gas()),
            "Insufficient payout gas"
        );
    }
    fn event(id: u64, event: &str) {
        env::log_str(&format!("EVENT_JSON:{{\"standard\":\"agent_escrow\",\"version\":\"1.0.0\",\"event\":\"{}\",\"data\":[{{\"task_id\":\"{}\"}}]}}", event, id));
    }
}
