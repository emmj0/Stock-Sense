# 📱 StockSense App

**StockSense** is a modern, AI-driven investment management mobile app built with **React Native** and **Expo**.  
It allows users to manage and track their investments, access insights, and interact with a smooth, minimal interface.  

---

## 🚀 Getting Started

Follow the steps below to run the project locally on **Web**, **Android**, or **iOS**.

---

### 1️⃣ Clone the Repository

```bash
git clone https://github.com/Mujtaba/StockSense.git
cd StockSenseAppFrontend
2️⃣ Install Dependencies
bash
Copy code
npm install
3️⃣ Start the Development Server
bash
Copy code
npx expo start
This will start the Expo bundler and open a new tab in your browser with a QR code.

4️⃣ Run on Different Platforms
Platform	How to Run	Description
🌐 Web	Press w	Opens the app in your browser
🤖 Android	Press a	Runs on emulator or Expo Go app
🍎 iOS	Press i	Runs on iOS simulator (macOS only)
📱 Physical Device	Scan QR code	Open Expo Go app on your phone and scan the QR code

📲 Install Expo Go:

Android: Expo Go – Play Store

iOS: Expo Go – App Store

5️⃣ Connect to Backend (Optional)
If you are running your backend locally, make sure:

Both your PC and phone are connected to the same Wi-Fi network.

Replace localhost in your API URLs with your local IP address, e.g.:

js
Copy code
http://192.168.1.5:5000/api/auth/login
🧩 Project Structure
bash
Copy code
StockSenseAppFrontend/
 ├── assets/           # Images and logo
 ├── screens/          # Login, Signup, Dashboard screens
 ├── types/            # TypeScript definitions
 ├── App.tsx           # Main app entry point
 ├── package.json
 └── README.md
🧠 Technologies Used
React Native (Expo)

TypeScript

React Navigation

Axios

AsyncStorage

Reanimated & Framer Motion (for animations)

👨‍💻 Author
Muhammad Mujtaba Ali
Final Year Project — StockSense
Built with ❤️ using React Native + Expo