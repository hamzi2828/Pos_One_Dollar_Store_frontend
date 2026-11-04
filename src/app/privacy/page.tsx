// Public privacy policy (needed for the Android app on Google Play).

export const metadata = {
  title: 'Privacy Policy · DOLLAR & Co POS',
  description: 'How the DOLLAR & Co POS app handles information.',
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-white text-gray-800">
      <div className="mx-auto max-w-2xl px-4 py-10 sm:py-14">
        <p className="text-2xl font-black">
          <span className="text-[#FFD600] [text-shadow:0_0_1px_#000]">DOLLAR</span> <span className="text-green-500">&amp;</span> <span>Co</span>
        </p>
        <h1 className="mt-4 text-2xl font-semibold text-gray-900">Privacy Policy</h1>
        <p className="mt-1 text-sm text-gray-500">DOLLAR &amp; Co POS app · Last updated 4 November 2026</p>

        <section className="mt-6 space-y-4 text-[15px] leading-relaxed">
          <p>
            DOLLAR &amp; Co POS is the shop management app of DOLLAR &amp; Co, Nishat Center, Allama Iqbal Road, Mirpur, AJK. It is used only by the
            shop&apos;s owner and staff, who sign in with an account given to them by the shop.
          </p>
          <h2 className="pt-2 text-lg font-semibold text-gray-900">What the app uses</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>Your sign-in details (email and password), to let you into your account.</li>
            <li>The shop records you enter: products, stock, sales, purchases, expenses, staff attendance and similar business data.</li>
            <li>The camera, only when you choose to scan a barcode or add a photo (for example a bill or a receipt).</li>
            <li>Photos or files you choose to upload, such as bills and payment receipts.</li>
          </ul>
          <h2 className="pt-2 text-lg font-semibold text-gray-900">How it is used</h2>
          <p>
            This information is used only to run the shop: selling, stock, purchasing, accounts and reports. It is stored on our own secure servers.
            We do not sell it, we do not use it for advertising, and we do not share it with anyone except the services that host the app.
          </p>
          <h2 className="pt-2 text-lg font-semibold text-gray-900">Keeping and deleting data</h2>
          <p>
            Business records are kept as long as the shop needs them for its accounts. A staff member can ask the shop to close their account and
            remove their personal details.
          </p>
          <h2 className="pt-2 text-lg font-semibold text-gray-900">Contact</h2>
          <p>
            DOLLAR &amp; Co, Nishat Center, Allama Iqbal Road, Mirpur, AJK · WhatsApp +92 314 7000513
          </p>
        </section>
      </div>
    </main>
  );
}
