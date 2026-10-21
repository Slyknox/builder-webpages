import { HeroClient } from './HeroClient';

export default function Page() {
  return (
    <main>
      <HeroClient />
      <section style={{ height: '60vh', padding: 32 }}>After the hero</section>
    </main>
  );
}
