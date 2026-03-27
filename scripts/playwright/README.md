# Playwright Flow

This script automates the main local workflow:

1. Open the interview setup page
2. Create a session
3. Submit one answer
4. Finish the interview and wait for the report
5. Click `Accept Offer`
6. Run the Copilot command flow

## Install

```powershell
pnpm install
pnpm playwright:install
```

## Run

Build once before starting the verified Playwright target:

```powershell
pnpm build
```

Start the production app in one terminal:

```powershell
pnpm start:playwright
```

Run the automation in a second terminal:

```powershell
pnpm playwright:flow -- --base-url=http://127.0.0.1:3001
```

For a visible browser:

```powershell
pnpm playwright:flow:headed -- --base-url=http://127.0.0.1:3001
```

To target a different server:

```powershell
pnpm playwright:flow -- --base-url=http://127.0.0.1:4000
```

Artifacts are written to `output/playwright/anion-flow/<timestamp>/`.
