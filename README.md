<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/19wTXz-Osk-9GizKpG57vp0xmnvozvbSh

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

---

## Deploying Firebase Rules

If you are seeing **"Missing or insufficient permissions"** errors, it's because the default database rules are too strict. You need to deploy the updated rules file included in this project.

**Prerequisites:** Firebase CLI

1.  **Install Firebase Tools** (if you haven't already). Run this command in your terminal once:
    ```bash
    npm install -g firebase-tools
    ```

2.  **Login to Firebase.** Run this and follow the instructions in your browser:
    ```bash
    firebase login
    ```

3.  **Deploy the Rules.** Run the following command from your project directory. This will upload the `firestore.rules` file to your Firebase project, fixing the permission errors.
    ```bash
    npm run deploy:rules
    ```

After the deploy is complete, refresh your application. The errors should be gone.