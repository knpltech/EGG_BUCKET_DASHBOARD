import { db } from "../config/firebase.js";

async function listSupervisors() {
  const snapshot = await db.collection("supervisors").get();
  if (snapshot.empty) {
    console.log("No supervisors found.");
    return;
  }
  snapshot.forEach(doc => {
    const data = doc.data();
    console.log(`Username: ${data.username}, Zone: ${data.zone}`);
  });
}

listSupervisors();
