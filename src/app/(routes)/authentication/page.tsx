// app/(routes)/authentication/page.tsx
import { Suspense } from "react";
import AuthPage from "./AuthPage";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <AuthPage />
    </Suspense>
  );
}
