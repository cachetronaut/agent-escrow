//! Testnet NEAR escrow. No admin withdrawals, upgrades, or mainnet path.
use near_sdk::collections::LookupMap;
use near_sdk::json_types::{U128, U64};
use near_sdk::{env, near, AccountId, Gas, NearToken, PanicOnDefault, Promise, PromiseResult};

const STORAGE_FEE: u128 = 100_000_000_000_000_000_000_000; // 0.1 NEAR, retained
const CALLBACK_GAS: Gas = Gas::from_tgas(15);
const MIN_PAYOUT_GAS: Gas = Gas::from_tgas(35);

#[near(serializers = [borsh, json])]
#[derive(Clone, Debug, PartialEq)]
pub enum Status {
    Open,
    Delivered,
    Approved,
    PayingWorker,
    Paid,
    Refundable,
    Refunding,
    Refunded,
}

#[near(serializers = [borsh, json])]
#[derive(Clone)]
pub struct Task {
    pub client: AccountId,
    pub worker: AccountId,
    pub verifier: AccountId,
    pub title: String,
    pub criteria: String,
    pub budget: U128,
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

    /// Attach exactly budget + storage_fee(). Deadline is in nanoseconds.
    #[payable]
    pub fn create_task(
        &mut self,
        worker: AccountId,
        verifier: AccountId,
        title: String,
        criteria: String,
        budget: U128,
        deadline_ns: U64,
    ) -> U64 {
        let client = env::predecessor_account_id();
        for id in [&client, &worker, &verifier] {
            Self::testnet(id);
        }
        assert!(
            client != worker && client != verifier && worker != verifier,
            "Distinct roles required"
        );
        assert!(
            !title.trim().is_empty() && title.len() <= 160,
            "Invalid title"
        );
        assert!(
            !criteria.trim().is_empty() && criteria.len() <= 2048,
            "Invalid criteria"
        );
        assert!(budget.0 > 0, "Zero budget");
        let now = env::block_timestamp();
        assert!(
            deadline_ns.0 > now
                && deadline_ns.0 <= now.checked_add(30 * 24 * 3600 * 1_000_000_000).unwrap(),
            "Deadline outside next 30 days"
        );
        let total = budget.0.checked_add(STORAGE_FEE).expect("Amount overflow");
        assert_eq!(
            env::attached_deposit().as_yoctonear(),
            total,
            "Attach budget + storage fee exactly"
        );
        let id = self.next_id;
        self.next_id = id.checked_add(1).expect("ID overflow");
        let before = env::storage_usage();
        self.tasks.insert(
            &id,
            &Task {
                client,
                worker,
                verifier,
                title,
                criteria,
                budget,
                deadline_ns,
                evidence_sha256: None,
                status: Status::Open,
            },
        );
        // Fee includes headroom for evidence and the longest status representation.
        let storage = u128::from(env::storage_usage().saturating_sub(before) + 256)
            .checked_mul(env::storage_byte_cost().as_yoctonear())
            .unwrap();
        assert!(STORAGE_FEE >= storage, "Storage fee insufficient");
        Self::event(id, "created");
        U64(id)
    }

    pub fn deliver(&mut self, task_id: U64, evidence_sha256: String) {
        let mut t = self.load(task_id.0);
        assert_eq!(env::predecessor_account_id(), t.worker, "Worker only");
        assert!(matches!(t.status, Status::Open), "Task not open");
        assert!(env::block_timestamp() < t.deadline_ns.0, "Expired");
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

    /// Approval is final. A failed transfer remains payable to the worker.
    pub fn approve(&mut self, task_id: U64) -> Promise {
        Self::payout_gas();
        let mut t = self.load(task_id.0);
        assert_eq!(env::predecessor_account_id(), t.verifier, "Verifier only");
        assert!(matches!(t.status, Status::Delivered), "Not delivered");
        assert!(env::block_timestamp() < t.deadline_ns.0, "Expired");
        t.status = Status::Approved;
        self.tasks.insert(&task_id.0, &t);
        Self::event(task_id.0, "approved");
        self.pay(task_id)
    }

    /// Anyone may trigger expiry; funds always return to the original client.
    pub fn expire(&mut self, task_id: U64) -> Promise {
        Self::payout_gas();
        let mut t = self.load(task_id.0);
        assert!(
            matches!(t.status, Status::Open | Status::Delivered),
            "Not expirable"
        );
        assert!(env::block_timestamp() >= t.deadline_ns.0, "Not expired");
        t.status = Status::Refundable;
        self.tasks.insert(&task_id.0, &t);
        Self::event(task_id.0, "expired");
        self.pay(task_id)
    }

    /// Permissionless retry. No caller can change the beneficiary.
    pub fn pay(&mut self, task_id: U64) -> Promise {
        Self::payout_gas();
        let mut t = self.load(task_id.0);
        let recipient = match t.status {
            Status::Approved => {
                t.status = Status::PayingWorker;
                t.worker.clone()
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
            .transfer(NearToken::from_yoctonear(t.budget.0))
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
        let ok = matches!(env::promise_result(0), PromiseResult::Successful(_));
        t.status = match (&t.status, ok) {
            (Status::PayingWorker, true) => Status::Paid,
            (Status::PayingWorker, false) => Status::Approved,
            (Status::Refunding, true) => Status::Refunded,
            (Status::Refunding, false) => Status::Refundable,
            _ => env::panic_str("No transfer pending"),
        };
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
            env::prepaid_gas()
                .as_gas()
                .saturating_sub(env::used_gas().as_gas())
                >= MIN_PAYOUT_GAS.as_gas(),
            "Insufficient payout gas"
        );
    }
    fn event(id: u64, event: &str) {
        env::log_str(&format!("EVENT_JSON:{{\"standard\":\"agent_escrow\",\"version\":\"1.0.0\",\"event\":\"{}\",\"data\":[{{\"task_id\":\"{}\"}}]}}", event, id));
    }
}
