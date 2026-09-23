# Temporary preview: GitHub + Render

This setup is for sharing work in progress. No custom domain, paid service, or database is required. Nothing has been published by the local preparation work.

## 1. Put the project on GitHub

1. Create/sign in to your GitHub account at https://github.com.
2. Install GitHub Desktop from https://desktop.github.com and sign in.
3. In Desktop, choose File > Add local repository and select `C:\Users\oneil\Documents\TamaronWebsite`.
4. If Desktop reports that this is not a Git repository, use its create-a-repository-here option. The resulting repository folder must be the existing TamaronWebsite folder. If prompted for name and parent location, use name `TamaronWebsite` and local path `C:\Users\oneil\Documents`. Do not create a second TamaronWebsite folder inside the first. Keep the existing .gitignore; do not select another ignore template.
5. Review Changes. Source files, tests, .node-version, .gitignore, package.json, package-lock.json, and public files/PDFs belong in the repository. node_modules, cert, .env files, tmp, and the local chat archive should not appear; .gitignore excludes them.
6. If changes remain uncommitted, enter `Prepare Tamaron preview` in Summary and click Commit to main (or the branch Desktop shows).
7. Click Publish repository. Suggested name: `tamaron-preview`. Keep **Keep this code private** checked. Publish it to your account. This uploads the website and documents to your private GitHub repository.

Do not use GitHub's browser file uploader for this project: the by-laws PDF is larger than its per-file browser upload limit. GitHub Desktop uses Git and handles it.

## 2. Create the free Render web service

1. Sign up/sign in at https://dashboard.render.com.
2. Select New > Web Service. Connect GitHub and grant access to only the preview repository when possible. Select that repository.
3. Use these settings:

| Setting | Value |
| --- | --- |
| Name | tamaron-preview, or another available name |
| Language/runtime | Node |
| Branch | The branch published by Desktop, usually main |
| Region | The closest available US region |
| Root directory | Leave blank |
| Build command | npm ci && npm test |
| Start command | npm start |
| Instance type | Free ($0) |
| Auto-deploy | On commit |

Select Web Service, not Static Site: login requires the Node server. No disk or database is needed. Node 24 is selected by .node-version.

## 3. Add environment variables before deploying

| Key | Value |
| --- | --- |
| NODE_ENV | production |
| PREVIEW_MODE | true |
| RESIDENT_PASSWORD | A new preview password you choose and share with intended resident-area reviewers |
| SESSION_SECRET | A separate, random server secret; never share this with reviewers |

Generate SESSION_SECRET in your local terminal with:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Paste the generated value directly into Render, not into source code, GitHub, or chat. The server refuses to start in production without both secrets. Locally, npm start still uses the existing development password unless an environment override is set.

The production cookie uses HTTPS through Render's proxy. Preview mode requests that search engines not index the site; it does not make the public home page private. Resident pages and documents still require login. Login attempts are limited to 10 failures per IP per 15-minute window.

## 4. Deploy and share

1. Confirm Free is selected and click Deploy Web Service (the button may say Create Web Service).
2. Wait for the build/start logs to show a successful deploy and the service status to become Live.
3. Open the service's actual https://...onrender.com address from Render. This is the shareable link; do not share localhost or the GitHub repository URL as the website preview.
4. In a private/incognito window, check the homepage and public PDFs, then try /resident.html and /downloads/Board2026.pdf before login. Both should redirect to the homepage.
5. Log in with RESIDENT_PASSWORD, check board information, forms, clubhouse documents and minutes, then visit /logout and check that resident access is blocked again.
6. Send reviewers the preview URL. Send the resident password only to people who should see resident information.

## 5. Publish later changes

Edit this same project folder, then use GitHub Desktop: review Changes > enter a Summary > Commit > Push origin. Saving files alone does not upload them. Render rebuilds automatically after the push; wait until Live before asking reviewers to refresh. PDFs added through Git are part of the deployment and survive redeployment. Upload new files here locally and push them, rather than modifying Render's temporary filesystem.

## Free-preview limits

- Render sleeps after 15 idle minutes; waking may take about a minute.
- Free instance hours, bandwidth and build minutes have limits. Keep the service on Free. To avoid overage charges, do not add a payment method for this preview; Render documents suspension/build disabling when included usage is exhausted without a payment method. If account verification requires billing details, stop and review the current billing terms before proceeding.
- This small preview uses in-memory login sessions. Restarts, deploys and sleep/wake cycles may require visitors to log in again. It is not the final session-storage architecture.
- Do not create a free Postgres database: the site does not need one, and that product has separate expiration rules.
- Future permanent hosting can use this same repository. You can delete the Render preview service when finished.

Sources: https://render.com/docs/free ; https://render.com/docs/deploy-node-express-app ; https://render.com/docs/configure-environment-variables ; https://docs.github.com/en/desktop/adding-and-cloning-repositories/adding-a-repository-from-your-local-computer-to-github-desktop
