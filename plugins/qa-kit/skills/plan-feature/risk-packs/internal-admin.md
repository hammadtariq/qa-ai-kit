# Internal admin and back-office

**Usual disasters:** a record approved by someone who shouldn't approve it (including their own); a bulk
action or import that changes the wrong records; reports that disagree with the records; deleted data
that other records depend on; no history of who changed what.

**Dirty paths:** importing a file with duplicates, blanks or a wrong column; approving then editing;
running a bulk action on a filtered list that changed meanwhile; two people editing one record; exporting
a very large list.

**Where the owner looks:** the approvals queue, audit log, monthly reports and exports, the record's own
history.

**Questions:** Who approves what, and can anyone approve their own request? What happens to an approved
record that is edited? Which imports are allowed to overwrite existing records? Who reads the reports,
and what decisions do they make from them?
