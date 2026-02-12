'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { AnimatedGradientText } from './animated-gradient-text';
import { BorderBeam } from './border-beam';
import { DotPattern } from './dot-pattern';
import { cn } from '@/lib/utils';

export function ComingSoonHero() {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-background">
      <DotPattern
        className={cn('[mask-image:radial-gradient(300px_circle_at_center,white,transparent)]')}
      />

      <div className="relative z-10 flex flex-col items-center justify-center space-y-8 px-4 text-center">
        <div className="space-y-4">
          <h1 className="text-5xl font-bold tracking-tight sm:text-6xl md:text-7xl">
            <AnimatedGradientText className="text-5xl sm:text-6xl md:text-7xl">
              Coming Soon
            </AnimatedGradientText>
          </h1>
          <p className="mx-auto max-w-[700px] text-lg text-muted-foreground sm:text-xl">
            We&apos;re building something amazing. Stay tuned for updates!
          </p>
        </div>

        <Card className="relative w-full max-w-md overflow-hidden">
          <BorderBeam duration={8} size={100} />
          <CardContent className="p-6">
            <form className="space-y-4">
              <div className="space-y-2">
                <Input type="email" placeholder="Enter your email" className="w-full" />
              </div>
              <Button type="submit" className="w-full">
                Notify Me
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
