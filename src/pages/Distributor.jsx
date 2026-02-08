import React from "react";
import Topbar from "../components/Topbar";
import Distributorcomp from "../components/Distributorcomp";
import Supervisor from "../components/Supervisor";

const Distributor = () => {
  return (
    <div className="min-h-screen bg-eggBg px-4 py-6 md:px-8 flex">

      <div className="flex-1 p-4 pt-0 overflow-x-hidden">
        <Topbar />
        <Distributorcomp />
        <Supervisor/>
      </div>
    </div>
  );
};

export default Distributor;
