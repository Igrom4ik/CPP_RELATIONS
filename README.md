<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/16FlNbgci8vikQ08iRcxMgfgodzjlfn6O

## Run Locally

**Prerequisites:**  Node.js


1. Clone the repository with submodules:
   ```bash
   git clone --recursive https://github.com/Igrom4ik/CPP_RELATIONS.git
   # OR if already cloned:
   git submodule update --init --recursive
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key

4. Run the app:
   ```bash
   npm run dev
   ```

## Credits & Licenses

### Icons
This project uses icons from [vscode-icons](https://github.com/vscode-icons/vscode-icons):
- **Icons License**: [Creative Commons ShareAlike (CC BY-SA)](https://creativecommons.org/licenses/by-sa/4.0/)
- **Source Code License**: MIT License
- **Branded icons** are licensed under their respective copyright licenses

### Project License
This project's source code is licensed under the MIT License (see LICENSE file).

### Third-Party Libraries
- React, Vite, TypeScript - MIT License
- D3.js - BSD 3-Clause License
- Framer Motion - MIT License
- Tailwind CSS - MIT License
