import './styles.css';
import '../../../packages/design-tokens/typography.css';
import SystemPreferences from './system-preferences';
import ManagerNavigation from './manager-navigation';
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const initializeAppearance = `(function(){try{var saved=localStorage.getItem('theme');var theme=saved==='light'||saved==='dark'?saved:(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');var locale=localStorage.getItem('locale')==='en'?'en':'ar';var scale=localStorage.getItem('typographyScale');var font=localStorage.getItem('organizationFont');document.documentElement.dataset.theme=theme;document.documentElement.dataset.typographyScale=['compact','standard','comfortable','large'].indexOf(scale)>-1?scale:'standard';if(font)document.documentElement.dataset.font=font;document.documentElement.lang=locale;document.documentElement.dir=locale==='ar'?'rtl':'ltr'}catch(e){}})()`;
  return <html lang="ar" dir="rtl" suppressHydrationWarning><head><script dangerouslySetInnerHTML={{ __html: initializeAppearance }} /></head><body>{children}<ManagerNavigation /><SystemPreferences /></body></html>;
}
