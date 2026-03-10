import { db } from "../config/firebase.js";

/* ADD INCENTIVE */
export const addIncentive = async (req, res) => {
  try {

    const { date, outlet, value } = req.body;

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

      await ref.update({
        [`outlets.${outlet}`]: Number(value),
        total: newTotal
      });

    } else {

      await ref.set({
        date,
        outlets: {
          [outlet]: Number(value)
        },
        total: Number(value)
      });

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