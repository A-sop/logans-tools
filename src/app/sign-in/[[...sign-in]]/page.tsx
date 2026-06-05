import { SignIn } from '@clerk/nextjs';

export default function SignInPage() {
  return (
    <div className="bg-background flex min-h-screen flex-col items-center justify-center px-4 py-10">
      <div className="mb-6 max-w-sm text-center">
        <h1 className="text-2xl font-bold tracking-tight">DABOS</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          Sign in with your allowlisted Google account to open the organizing board.
        </p>
      </div>
      <SignIn routing="path" path="/sign-in" />
    </div>
  );
}
