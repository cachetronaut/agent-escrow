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
    pub retention_percent: u8,
    pub warranty_window_ns: U64,
    pub warranty_until_ns: U64,
    pub hold_amount: U128,
    pub claim_evidence_sha256: Option<String>,
    pub fix_evidence_sha256: Option<String>,
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
        retention_percent: Option<u8>,
        warranty_window_ns: Option<U64>,
    ) -> U64 {
        let retention_percent = retention_percent.unwrap_or(10);
        let warranty_window_ns = warranty_window_ns.unwrap_or(U64(7 * 24 * 3600 * 1_000_000_000));
        assert!(
            retention_percent <= 100
                && warranty_window_ns.0 > 0
                && warranty_window_ns.0 <= policy::MAX_DEADLINE_DISTANCE,
            "Invalid warranty terms"
        );
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
                retention_percent,
                warranty_window_ns,
                warranty_until_ns: U64(0),
                hold_amount: U128(0),
                claim_evidence_sha256: None,
                fix_evidence_sha256: None,
            },
        );
        // Each future bid needs at most 4 + 64 + 16 bytes. The extra 256
        // reserves the selected worker, evidence, and serialized-state growth.
        let reserve = policy::MAX_BIDS as u64 * 84 + 512;
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
        t.hold_amount = U128(
            t.escrow_amount.0 / 100 * u128::from(t.retention_percent)
                + t.escrow_amount.0 % 100 * u128::from(t.retention_percent) / 100,
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
        let mut amount = t.escrow_amount.0;
        let recipient = match t.status {
            Status::Approved => {
                amount -= t.hold_amount.0;
                t.status = Status::PayingWorker;
                t.worker.clone().expect("No selected worker")
            }
            Status::Refundable => {
                t.status = Status::Refunding;
                t.client.clone()
            }
            Status::HoldApproved => {
                amount = t.hold_amount.0;
                t.status = Status::PayingHold;
                t.worker.clone().expect("No selected worker")
            }
            Status::HoldRefundable => {
                amount = t.hold_amount.0;
                t.status = Status::RefundingHold;
                t.client.clone()
            }
            _ => env::panic_str("No payable balance"),
        };
        self.tasks.insert(&task_id.0, &t);
        Self::event(task_id.0, "transfer_started");
        Promise::new(recipient)
            .transfer(NearToken::from_yoctonear(amount))
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
        let initial = t.status == Status::PayingWorker;
        t.status = policy::receipt_status(&t.status, ok).expect("No transfer pending");
        if initial && ok && t.hold_amount.0 > 0 {
            t.status = Status::Warranty;
            t.warranty_until_ns = U64(env::block_timestamp()
                .checked_add(t.warranty_window_ns.0)
                .expect("Warranty overflow"));
        }
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

    /// Client evidence locks the hold before expiry. Only a digest is stored.
    pub fn claim(&mut self, task_id: U64, evidence_sha256: String) {
        let mut t = self.load(task_id.0);
        assert!(
            env::predecessor_account_id() == t.client
                && t.status == Status::Warranty
                && env::block_timestamp() < t.warranty_until_ns.0,
            "Claim denied"
        );
        Self::digest(&evidence_sha256);
        t.claim_evidence_sha256 = Some(evidence_sha256);
        t.status = Status::Claimed;
        self.tasks.insert(&task_id.0, &t);
        Self::event(task_id.0, "claimed");
    }

    /// Named verifier may request a fix or refund the hold; acceptance needs a fix delivery.
    pub fn resolve_claim(&mut self, task_id: U64, decision: String) -> PromiseOrValue<bool> {
        let mut t = self.load(task_id.0);
        assert!(
            env::predecessor_account_id() == t.verifier
                && matches!(
                    t.status,
                    Status::Claimed | Status::FixRequired | Status::FixDelivered
                ),
            "Resolution denied"
        );
        match decision.as_str() {
            "fix" => {
                assert!(t.status == Status::Claimed, "Fix already requested");
                t.status = Status::FixRequired;
            }
            "refund" => {
                Self::payout_gas();
                t.status = Status::HoldRefundable;
            }
            "accept" => {
                Self::payout_gas();
                assert!(t.status == Status::FixDelivered, "Fix delivery required");
                t.status = Status::HoldApproved;
            }
            _ => env::panic_str("Expected fix, refund, or accept"),
        }
        self.tasks.insert(&task_id.0, &t);
        Self::event(task_id.0, "claim_resolved");
        if decision == "fix" {
            PromiseOrValue::Value(true)
        } else {
            PromiseOrValue::Promise(self.pay(task_id))
        }
    }

    pub fn deliver_fix(&mut self, task_id: U64, evidence_sha256: String) {
        let mut t = self.load(task_id.0);
        assert!(
            t.worker.as_ref() == Some(&env::predecessor_account_id())
                && t.status == Status::FixRequired,
            "Fix denied"
        );
        Self::digest(&evidence_sha256);
        t.fix_evidence_sha256 = Some(evidence_sha256);
        t.status = Status::FixDelivered;
        self.tasks.insert(&task_id.0, &t);
        Self::event(task_id.0, "fix_delivered");
    }

    /// Keepers must call this; the blockchain does not schedule automatic transfers.
    pub fn settle_warranty(&mut self, task_id: U64) -> Promise {
        Self::payout_gas();
        let mut t = self.load(task_id.0);
        assert!(
            t.status == Status::Warranty && env::block_timestamp() >= t.warranty_until_ns.0,
            "Warranty settlement denied"
        );
        t.status = Status::HoldApproved;
        self.tasks.insert(&task_id.0, &t);
        self.pay(task_id)
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
    fn digest(value: &str) {
        assert!(
            value.len() == 64
                && value
                    .bytes()
                    .all(|b| b.is_ascii_hexdigit() && !b.is_ascii_uppercase()),
            "Expected lowercase SHA-256"
        );
    }
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
