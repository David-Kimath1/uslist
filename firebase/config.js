import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyBrE30KUsrMji_V2FnIqdthtS8iyjcOa-s",
    authDomain: "uslist-249cd.firebaseapp.com",
    projectId: "uslist-249cd",
    storageBucket: "uslist-249cd.firebasestorage.app",
    messagingSenderId: "1083633631906",
    appId: "1:1083633631906:web:455c8496c98a65da364dfb",
    measurementId: "G-3N2059JMRG"
};

const app = initializeApp(firebaseConfig);

const auth = getAuth(app);
const db = getFirestore(app);

export { app, auth, db };