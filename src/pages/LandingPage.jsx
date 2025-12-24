import { Link } from "react-router-dom";
import logo from "../assets/Logo.png";
import egg from "../assets/egg.png";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-eggBg flex flex-col p-6 relative overflow-hidden">

      {/* FALLING EGGS ANIMATION */}
      {[...Array(6)].map((_, i) => (
        <img
          key={i}
          src={egg}
          className="egg-fall"
          style={{
            left: `${Math.random() * 90}vw`,
            animationDuration: `${6 + Math.random() * 5}s`,
            animationDelay: `${Math.random() * 5}s`,
            width: "70px",
            opacity: 0.8
          }}
        />
      ))}

      {/* TOP NAVBAR */}
      <nav className="w-full flex items-center justify-between px-4 py-2 animate-fade-in relative z-10">
        <div className="flex items-center gap-3 bg-eggBg p-1 rounded-md">
          <img src={logo} alt="Egg Bucket Logo" className="w-28 sm:w-32 md:w-40 h-auto object-contain mix-blend-multiply opacity-95" />
        </div>

        <div className="flex gap-5">
          <Link
            to="/signin"
            className="px-8 py-2 rounded-full text-eggOrange font-semibold border border-eggOrange hover:bg-orange-50 transition"
          >
            Sign In
          </Link>
        </div>
      </nav>

      {/* MAIN CONTENT */}
      <div className="flex flex-col items-center mt-24 text-center max-w-3xl mx-auto animate-slide-up relative z-10">
        <h1 className="text-5xl font-bold leading-tight text-[#2B1A0E]">
          Smart Insights for <br /> Egg Distribution
        </h1>

        <p className="text-gray-700 mt-6 text-lg">
         Egg Bucket empowers distributors with end-to-end visibility across sourcing, inventory,
          delivery, and payments — helping you reduce loss, increase efficiency, and 
          scale your egg business with confidence.
        </p>
      </div>

      {/* PUSH SOCIAL SECTION DOWN (so it's not visible on load) */}
      <div className="mt-52"></div>

      {/* SOCIAL SECTION — FULL WIDTH */}
      <div
        className="
          w-screen 
          relative left-[50%] right-[50%] ml-[-50vw] mr-[-50vw]
          bg-[#F3D7AE] py-6 mt-20 animate-fade-in text-center z-10
        "
      >
        <p className="font-semibold mb-3 text-[#2C1A0C]">
          Get connected with us on social networks:
        </p>

        <div className="flex justify-center gap-6 text-2xl text-[#2C1A0C]">
          <a href="#"><i className="fab fa-facebook"></i></a>
          <a href="#"><i className="fab fa-twitter"></i></a>
          <a href="#"><i className="fab fa-google"></i></a>
          <a href="#"><i className="fab fa-instagram"></i></a>
          <a href="#"><i className="fab fa-linkedin"></i></a>
          <a href="#"><i className="fab fa-github"></i></a>
        </div>
      </div>

      {/* FOOTER — FULL WIDTH */}
      <footer
        className="
          w-screen 
          relative left-[50%] right-[50%] ml-[-50vw] mr-[-50vw]
          bg-[#0D0F1A] text-white py-16 px-6 border-t border-orange-300 animate-fade-in z-10
        "
      >
        <div className="max-w-7xl mx-auto grid md:grid-cols-4 gap-12">

          {/* CONTACT */}
          <div>
            <h3 className="font-bold text-xl mb-4">Contact Us</h3>
            <div className="inline-block bg-eggBg p-1 rounded-md">
              <img src={logo} alt="Egg Bucket Logo" className="w-10 sm:w-12 md:w-16 h-auto mb-4 object-contain mix-blend-multiply opacity-95" />
            </div>
            <p className="leading-relaxed">
              Kacklewalls Nutrition Pvt. Ltd.<br />
              1179, AECS Layout, Singasandra<br />
              Bengaluru, Karnataka 560068
            </p>
            <p className="mt-4 flex items-center gap-2">
              <i className="fas fa-envelope text-eggOrange"></i> support@eggbucket.in
            </p>
            <p className="mt-2 flex items-center gap-2">
              <i className="fas fa-phone text-eggOrange"></i> +91 7204704048
            </p>
          </div>

          {/* PRODUCTS */}
          <div>
            <h3 className="font-bold text-xl mb-4">Products</h3>
            <ul className="space-y-2">
              <li>EggBucket Fresh</li>
              <li>Protein Plus Eggs</li>
              <li>Organic Farm Eggs</li>
              <li>Free-range Eggs</li>
            </ul>
          </div>

          {/* USEFUL LINKS */}
          <div>
            <h3 className="font-bold text-xl mb-4">Useful Links</h3>
            <ul className="space-y-2">
              <li>Your Account</li>
              <li>Become an Affiliate</li>
              <li>Shipping Rates</li>
              <li>Help</li>
            </ul>
          </div>

          {/* SUPPORT */}
          <div>
            <h3 className="font-bold text-xl mb-4">Let Us Help You</h3>
            <ul className="space-y-2">
              <li>Refund Policy</li>
              <li>Return Policy</li>
              <li>Shipping Policy</li>
              <li>Privacy Policy</li>
            </ul>
          </div>
        </div>

        {/* LINE */}
        <div className="w-full h-px bg-gray-700 mt-10 mb-6"></div>

        {/* COPYRIGHT */}
        <div className="text-center text-gray-400 text-sm">
          © 2025 Egg Bucket. All rights reserved.
        </div>
      </footer>

    </div>
  );
}
