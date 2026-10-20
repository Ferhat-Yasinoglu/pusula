export function registerProvider(program) {
  program
    .command("provider [subcommand]")
    .description("Manage provider connections (use 'providers' for the full interface)")
    .allowUnknownOption()
    .allowExcessArguments()
    .action(() => {
      console.log(`
  Use \`pusula providers\` for the full provider management interface:

    pusula providers available   — show provider catalog
    pusula providers list        — list configured connections
    pusula providers test <name> — test a provider connection
    pusula providers test-all    — test all active connections
    pusula providers validate    — validate local configuration
    pusula providers add <id>    — add an API-key connection
    pusula providers auth <id>   — start an existing OAuth flow
    pusula providers remove <id> — remove a connection (requires confirmation)
`);
    });
}
