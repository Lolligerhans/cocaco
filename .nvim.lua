-- ╭───────────────────────────────────────────────────────────╮
-- │ Load all JS to make relevant context available to         │
-- │ LSP/Plugins                                               │
-- ╰───────────────────────────────────────────────────────────╯

vim.api.nvim_create_user_command(
  "SetJsArgs",
  "args javascript/**/*.js",
  { desc = "Set all extension .js files as argumetns" }
)

vim.api.nvim_create_user_command(
  "LoadJs",
  "argdo norm j",
  { desc = "Ensure all args are loaded by LSP" }
)

vim.keymap.set(
  "n",
  "<leader>cL",
  "<cmd>SetJsArgs<cr> | <cmd>LoadJs<cr>",
  { desc = "Load JS context" }
)

vim.opt.foldlevelstart = 99
