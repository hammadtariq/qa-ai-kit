### Ant Design UI

- **antd Select / AutoComplete / TreeSelect pickers:** use the helpers in `e2e/support/antd.ts`, e.g.
  `await antSelect(page, "Company", "Coastal Traders")`. They handle two traps:
  - `getByRole("option", { name })` matches antd's hidden 0×0 accessibility list, so clicking it waits forever.
  - Form.Item labels without a `name` prop aren't linked to their input, so `getByLabel("Company")` finds nothing.
- Avoid `.ant-*` class selectors in specs; they change between antd versions. Keep them inside `e2e/support/antd.ts`.
