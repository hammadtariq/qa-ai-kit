# Fintech and ledgers

**Usual disasters:** money created or lost (a ledger that doesn't balance); a transfer sent twice; a balance
going negative where it mustn't; rounding errors that add up; a statement that disagrees with the ledger;
one customer's balance or history visible to another; a change to a posted entry with no trace.

**Dirty paths:** retrying a transfer after a timeout; reversing an entry; amounts with many decimals or
different currencies; transfers at the end of a statement period; two transfers from the same balance at
once; a backdated correction.

**Where the owner looks:** account balances, statements, the reconciliation report, the audit trail, the
regulator's or accountant's exports.

**Questions:** Can a posted entry ever change, or only be reversed? How are amounts rounded, and where? Can
a balance go negative, and for whom? Which records must be kept, and for how long?
