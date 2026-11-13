//! Production transition policy, testable without executing SDK dependencies.
pub const MAX_BIDS: usize = 8;
pub const MAX_DEADLINE_DISTANCE: u64 = 30 * 24 * 3600 * 1_000_000_000;

#[cfg_attr(not(policy_test), near_sdk::near(serializers = [borsh, json]))]
#[derive(Clone, Debug, PartialEq)]
pub enum Status {
    Posted,
    Open,
    Delivered,
    Approved,
    PayingWorker,
    Paid,
    Refundable,
    Refunding,
    Refunded,
    Cancelled,
    Warranty,
    Claimed,
    FixRequired,
    FixDelivered,
    HoldApproved,
    PayingHold,
    HoldRefundable,
    RefundingHold,
    HoldRefunded,
}

pub fn valid_post_roles(client: &str, verifier: &str, contract: &str) -> bool {
    client != verifier && client != contract && verifier != contract
}

pub fn valid_post_terms(
    title: &str,
    criteria: &str,
    budget: u128,
    now: u64,
    deadline: u64,
) -> bool {
    !title.trim().is_empty()
        && title.len() <= 160
        && !criteria.trim().is_empty()
        && criteria.len() <= 2048
        && budget > 0
        && deadline > now
        && deadline <= now.saturating_add(MAX_DEADLINE_DISTANCE)
}

#[allow(clippy::too_many_arguments)]
pub fn can_bid(
    caller: &str,
    client: &str,
    verifier: &str,
    contract: &str,
    status: &Status,
    now: u64,
    deadline: u64,
    amount: u128,
    budget: u128,
    already_bid: bool,
    bid_count: usize,
) -> bool {
    *status == Status::Posted
        && now < deadline
        && caller != client
        && caller != verifier
        && caller != contract
        && amount > 0
        && amount <= budget
        && !already_bid
        && bid_count < MAX_BIDS
}

pub fn can_escrow(
    caller: &str,
    client: &str,
    status: &Status,
    now: u64,
    deadline: u64,
    bid_amount: Option<u128>,
    deposit: u128,
) -> bool {
    caller == client
        && *status == Status::Posted
        && now < deadline
        && matches!(bid_amount, Some(amount) if amount > 0 && deposit == amount)
}

pub fn can_deliver(
    caller: &str,
    worker: Option<&str>,
    status: &Status,
    now: u64,
    deadline: u64,
) -> bool {
    worker == Some(caller) && *status == Status::Open && now < deadline
}
pub fn can_release(caller: &str, verifier: &str, status: &Status, now: u64, deadline: u64) -> bool {
    caller == verifier && *status == Status::Delivered && now < deadline
}
pub fn can_refund(status: &Status, now: u64, deadline: u64) -> bool {
    matches!(status, Status::Posted | Status::Open | Status::Delivered) && now >= deadline
}
pub fn receipt_status(status: &Status, ok: bool) -> Option<Status> {
    match (status, ok) {
        (Status::PayingWorker, true) => Some(Status::Paid),
        (Status::PayingWorker, false) => Some(Status::Approved),
        (Status::Refunding, true) => Some(Status::Refunded),
        (Status::Refunding, false) => Some(Status::Refundable),
        (Status::PayingHold, true) => Some(Status::Paid),
        (Status::PayingHold, false) => Some(Status::HoldApproved),
        (Status::RefundingHold, true) => Some(Status::HoldRefunded),
        (Status::RefundingHold, false) => Some(Status::HoldRefundable),
        _ => None,
    }
}
pub fn payout_gas(prepaid: u64, used: u64) -> bool {
    prepaid.saturating_sub(used) >= 35_000_000_000_000
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn post_roles_exclude_each_other_and_contract() {
        assert!(valid_post_roles("client", "verifier", "contract"));
        assert!(!valid_post_roles("client", "client", "contract"));
        assert!(!valid_post_roles("contract", "verifier", "contract"));
        assert!(!valid_post_roles("client", "contract", "contract"));
    }

    #[test]
    fn post_terms_require_positive_budget_text_and_bounded_deadline() {
        assert!(valid_post_terms("task", "criteria", 1, 1, 2));
        for (title, criteria, amount, deadline) in [
            (" ", "criteria", 1, 2),
            ("task", " ", 1, 2),
            ("task", "criteria", 0, 2),
            ("task", "criteria", 1, 1),
            ("task", "criteria", 1, MAX_DEADLINE_DISTANCE + 2),
        ] {
            assert!(!valid_post_terms(title, criteria, amount, 1, deadline));
        }
        assert!(valid_post_terms(
            "task",
            "criteria",
            1,
            1,
            MAX_DEADLINE_DISTANCE + 1
        ));
        assert!(!valid_post_terms(&"é".repeat(81), "criteria", 1, 1, 2));
        assert!(!valid_post_terms("task", &"x".repeat(2049), 1, 1, 2));
    }

    fn bid(
        caller: &str,
        status: &Status,
        now: u64,
        amount: u128,
        duplicate: bool,
        count: usize,
    ) -> bool {
        can_bid(
            caller, "client", "verifier", "contract", status, now, 10, amount, 100, duplicate,
            count,
        )
    }

    #[test]
    fn bidding_accepts_only_eligible_workers_before_deadline() {
        assert!(bid("worker", &Status::Posted, 9, 50, false, 0));
        for caller in ["client", "verifier", "contract"] {
            assert!(!bid(caller, &Status::Posted, 9, 50, false, 0));
        }
        assert!(!bid("worker", &Status::Posted, 10, 50, false, 0));
    }

    #[test]
    fn bidding_rejects_zero_overbudget_duplicate_and_storage_limit() {
        assert!(!bid("worker", &Status::Posted, 9, 0, false, 0));
        assert!(!bid("worker", &Status::Posted, 9, 101, false, 0));
        assert!(!bid("worker", &Status::Posted, 9, 50, true, 1));
        assert!(bid("worker", &Status::Posted, 9, 100, false, MAX_BIDS - 1));
        assert!(!bid("worker", &Status::Posted, 9, 50, false, MAX_BIDS));
    }

    #[test]
    fn bidding_stops_permanently_after_escrow_or_cancellation() {
        for status in [
            Status::Open,
            Status::Delivered,
            Status::Approved,
            Status::PayingWorker,
            Status::Paid,
            Status::Refundable,
            Status::Refunding,
            Status::Refunded,
            Status::Cancelled,
        ] {
            assert!(!bid("worker", &status, 9, 50, false, 0));
        }
    }

    #[test]
    fn only_client_can_escrow_existing_bid_with_exact_deposit() {
        assert!(can_escrow(
            "client",
            "client",
            &Status::Posted,
            9,
            10,
            Some(50),
            50
        ));
        assert!(!can_escrow(
            "worker",
            "client",
            &Status::Posted,
            9,
            10,
            Some(50),
            50
        ));
        assert!(!can_escrow(
            "client",
            "client",
            &Status::Posted,
            9,
            10,
            None,
            50
        ));
        for deposit in [0, 49, 51, 100] {
            assert!(!can_escrow(
                "client",
                "client",
                &Status::Posted,
                9,
                10,
                Some(50),
                deposit
            ));
        }
        assert!(!can_escrow(
            "client",
            "client",
            &Status::Posted,
            9,
            10,
            Some(0),
            0
        ));
    }

    #[test]
    fn escrow_cannot_repeat_or_cross_deadline() {
        assert!(!can_escrow(
            "client",
            "client",
            &Status::Posted,
            10,
            10,
            Some(50),
            50
        ));
        for status in [
            Status::Open,
            Status::Delivered,
            Status::Approved,
            Status::PayingWorker,
            Status::Paid,
            Status::Refundable,
            Status::Refunding,
            Status::Refunded,
            Status::Cancelled,
        ] {
            assert!(!can_escrow(
                "client",
                "client",
                &status,
                9,
                10,
                Some(50),
                50
            ));
        }
    }

    #[test]
    fn delivery_requires_selected_worker_funding_and_deadline() {
        assert!(can_deliver("worker", Some("worker"), &Status::Open, 9, 10));
        assert!(!can_deliver("client", Some("worker"), &Status::Open, 9, 10));
        assert!(!can_deliver(
            "other_bidder",
            Some("worker"),
            &Status::Open,
            9,
            10
        ));
        assert!(!can_deliver("worker", None, &Status::Posted, 9, 10));
        assert!(!can_deliver(
            "worker",
            Some("worker"),
            &Status::Open,
            10,
            10
        ));
        assert!(!can_deliver(
            "worker",
            Some("worker"),
            &Status::Delivered,
            9,
            10
        ));
    }

    #[test]
    fn release_requires_named_verifier_delivery_and_deadline() {
        assert!(can_release(
            "verifier",
            "verifier",
            &Status::Delivered,
            9,
            10
        ));
        for caller in ["worker", "client", "attacker"] {
            assert!(!can_release(caller, "verifier", &Status::Delivered, 9, 10));
        }
        for status in [Status::Posted, Status::Open, Status::Paid] {
            assert!(!can_release("verifier", "verifier", &status, 9, 10));
        }
        assert!(!can_release(
            "verifier",
            "verifier",
            &Status::Delivered,
            10,
            10
        ));
    }

    #[test]
    fn refund_requires_deadline_and_cannot_steal_approved_claim() {
        for state in [Status::Posted, Status::Open, Status::Delivered] {
            assert!(can_refund(&state, 10, 10));
            assert!(!can_refund(&state, 9, 10));
        }
        for state in [
            Status::Approved,
            Status::PayingWorker,
            Status::Paid,
            Status::Refundable,
            Status::Refunding,
            Status::Refunded,
            Status::Cancelled,
        ] {
            assert!(!can_refund(&state, 100, 10));
        }
    }

    #[test]
    fn receipts_preserve_failed_claim_and_settle_once() {
        assert_eq!(
            receipt_status(&Status::PayingWorker, true),
            Some(Status::Paid)
        );
        assert_eq!(
            receipt_status(&Status::PayingWorker, false),
            Some(Status::Approved)
        );
        assert_eq!(
            receipt_status(&Status::Refunding, true),
            Some(Status::Refunded)
        );
        assert_eq!(
            receipt_status(&Status::Refunding, false),
            Some(Status::Refundable)
        );
        for state in [
            Status::Posted,
            Status::Open,
            Status::Delivered,
            Status::Approved,
            Status::Paid,
            Status::Refundable,
            Status::Refunded,
            Status::Cancelled,
        ] {
            assert_eq!(receipt_status(&state, true), None);
            assert_eq!(receipt_status(&state, false), None);
        }
    }

    #[test]
    fn payout_gas_floor_is_checked_without_underflow() {
        assert!(payout_gas(100_000_000_000_000, 65_000_000_000_000));
        assert!(!payout_gas(100_000_000_000_000, 65_000_000_000_001));
        assert!(!payout_gas(1, 2));
    }
}
