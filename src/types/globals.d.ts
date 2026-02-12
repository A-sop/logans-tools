export {};

declare global {
  // Used by Clerk for JWT session claims augmentation
  // eslint-disable-next-line no-unused-vars -- declaration merge target
  interface CustomJwtSessionClaims {
    metadata?: {
      onboardingComplete?: boolean;
    };
  }
}
