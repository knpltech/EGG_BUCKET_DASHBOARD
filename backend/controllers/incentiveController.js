import { db } from "../config/firebase.js";

/* ADD INCENTIVE */
export const addIncentive = async (req, res) => {
  try {

    const { date, outlet, value, addedBy } = req.body;

    if (!date || !outlet || value === undefined) {
      return res.status(400).json({ error: "Missing fields" });
    }

    const ref = db.collection("incentive").doc(date);

    const doc = await ref.get();

    if (doc.exists) {

      const data = doc.data();
      const outlets = data.outlets || {};

      if (outlets[outlet] !== undefined) {
        return res.status(400).json({
          error: "Incentive already entered for this outlet on this date"
        });
      }

      const newTotal = (data.total || 0) + Number(value);

      const updatedData = {
        [`outlets.${outlet}`]: Number(value),
        total: newTotal
      };
      
      // Store addedBy info per outlet
      if (addedBy) {
        const addedByPerOutlet = data.addedByPerOutlet || {};
        addedByPerOutlet[outlet] = {
          username: addedBy.username,
          zone: addedBy.zone,
          role: addedBy.role,
          timestamp: addedBy.timestamp
        };
        updatedData.addedByPerOutlet = addedByPerOutlet;
      }

      await ref.update(updatedData);

    } else {

      const docData = {
        date,
        outlets: {
          [outlet]: Number(value)
        },
        total: Number(value)
      };
      
      // Store addedBy info per outlet
      if (addedBy) {
        docData.addedByPerOutlet = {
          [outlet]: {
            username: addedBy.username,
            zone: addedBy.zone,
            role: addedBy.role,
            timestamp: addedBy.timestamp
          }
        };
      }
      
      await ref.set(docData);

    }

    res.json({ success: true });

  } catch (err) {
    console.error(err);
    res.status(500).json(err.message);
  }
};


/* GET ALL INCENTIVES */
export const getAllIncentives = async (req, res) => {

  try {

    const snapshot = await db.collection("incentive").get();

    const data = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    res.json(data);

  } catch (err) {
    res.status(500).json(err.message);
  }

};

export const updateIncentive = async (req,res)=>{

const { id } = req.params;
const { outlets,total } = req.body;

try{

await db.collection("incentive").doc(id).update({
outlets,
total
});

res.json({success:true});

}catch(err){
res.status(500).json({error:err.message});
}

};