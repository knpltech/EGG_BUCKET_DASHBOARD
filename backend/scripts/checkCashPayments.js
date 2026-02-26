import { db } from "../config/firebase.js";

async function checkCashPayments() {
  const snapshot = await db.collection("cashPayments").orderBy("date", "desc").limit(10).get();
  snapshot.forEach(doc => {
    const data = doc.data();
    console.log(`ID: ${doc.id}, Date: ${data.date}, Outlets:`, data.outlets, 'Total:', data.total);
  });
  process.exit(0);
}

checkCashPayments();
