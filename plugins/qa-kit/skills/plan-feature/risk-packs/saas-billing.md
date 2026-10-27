# SaaS billing

**Usual disasters:** a customer billed for the wrong plan or billed twice; plan limits not enforced (or
enforced on a paying customer); a trial that never converts or never ends; access kept after a failed
payment, or lost while paid; invoices with wrong tax or amounts; one organization seeing another's data.

**Dirty paths:** upgrading and downgrading mid-cycle (proration); cancelling then resubscribing; a card
failing at renewal then being updated; hitting a limit exactly; seats removed below current usage;
changing currency or country; a renewal on the 31st of a month.

**Where the owner looks:** billing provider dashboard, MRR and churn reports, invoices sent to customers,
the plan and usage shown in the customer's account.

**Questions:** What happens on a failed renewal, and after how many days does access stop? Is a downgrade
immediate or at period end? Which limits block the user and which only warn? Who in a customer's
organization can change the plan?
