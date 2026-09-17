import type { Metadata } from 'next';
import { MarketingProvider } from './marketing-context';
import { MarketingFooter, MarketingHeader } from './marketing-shell';
import './marketing.css';

export const metadata: Metadata = {
  title: { default: 'Remote Work Intelligence', template: '%s | Remote Work Intelligence' },
  description: 'Privacy-conscious productivity intelligence for modern distributed teams.',
};

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return <MarketingProvider><div className="marketing-site"><MarketingHeader/><main>{children}</main><MarketingFooter/></div></MarketingProvider>;
}
