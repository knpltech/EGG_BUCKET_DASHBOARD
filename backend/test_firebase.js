import "dotenv/config";
import fetch from "node-fetch";

const RETAIL_ADMIN_API_URL = process.env.RETAIL_ADMIN_API_URL || "https://eggbucketretailadmin.onrender.com/api/admin";

const getRetailAdminToken = async () => {
  const username = String(process.env.RETAIL_ADMIN_USERNAME || "").trim();
  const password = String(process.env.RETAIL_ADMIN_PASSWORD || "");
  const response = await fetch(`${RETAIL_ADMIN_API_URL}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password, role: "admin" }),
  });
  const data = await response.json();
  return data?.token;
};

try {
  const token = await getRetailAdminToken();
  const response = await fetch(`${RETAIL_ADMIN_API_URL}/user-info`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (response.ok) {
    const customers = await response.json();
    const agents = new Map();
    
    customers.forEach(cust => {
      if (cust.last8Days) {
        Object.values(cust.last8Days).forEach(dayData => {
          const deliveries = Array.isArray(dayData) ? dayData : [dayData];
          deliveries.forEach(delivery => {
            if (delivery.agentId) {
              agents.set(delivery.agentId, delivery.agentName || "Unknown");
            }
          });
        });
      }
    });

    console.log("Unique Agents in Retail Admin deliveries:");
    agents.forEach((name, id) => {
      console.log(` - ID: ${id} -> Name: ${name}`);
    });
  }
} catch (err) {
  console.error("Error:", err.stack);
}
process.exit(0);
