# InkPark Review Genie

Build a simple mobile-first AI Review Generator for InkPark Tattoo Studio.

Flow

Scan QR → AI generates a natural review → Copy → Open Google Review page

When a customer scans the QR code, show a branded InkPark review page with a Generate Review button.

The AI should generate different natural review variations using manually configured studio information, services, artist details, experience keywords, and preset ideas from the admin panel.

Add:

Generate Review

Regenerate

Edit Review

Copy Review

Open Google Reviews

Google Review URL:
https://g.page/r/Cf-vHSmJ-os4EB0/review

The customer should be able to edit the generated text before copying it. Do not automatically submit anything to Google.

Admin Panel

Allow admin to manage:

Review presets

Studio information/keywords

AI generation instructions

Review categories

Active/inactive presets

Keep the UI extremely simple, premium, fast, and mobile-friendly with an InkPark Tattoo Studio black & white aesthetic.

Customer journey should take only a few seconds:
QR Scan → Generate → Copy → Open Google → Paste & Submit

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://ink-spark-reviews.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/d1996d0c-557b-44e1-b433-e8c166808145).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
