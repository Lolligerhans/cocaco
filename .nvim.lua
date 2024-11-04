-- ╭───────────────────────────────────────────────────────────╮
-- │ Load all JS to make relevant context available to         │
-- │ LSP/Plugins                                               │
-- ╰───────────────────────────────────────────────────────────╯

-- Set all relevant .js as vim arguments
vim.keymap.set(
  "n",
  "<leader>cj",
  -- The files containing JSDoc type definitions etc.
  "<cmd>args javascript/**/*.js<cr>",
  { remap = false, desc = "Use all JS as args" }
)

-- Make sure every argument is loaded
vim.keymap.set(
  "n",
  "<leader>cJ",
  "<cmd>argdo norm j<cr>", -- Use "norm j" as NOP
  { remap = false, desc = "Load all args" }
)

vim.opt.foldlevelstart = 99
