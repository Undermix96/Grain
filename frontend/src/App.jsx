import { Header } from './components/Header.jsx';
import { Gallery } from './components/Gallery.jsx';
import { Lightbox } from './components/Lightbox.jsx';

export function App() {
  return (
    <>
      <Header />
      <main>
        <Gallery />
      </main>
      <Lightbox />
    </>
  );
}
