import { useEffect, useState } from 'react';
import Accueil from './components/Accueil';
import Pilotage from './components/Pilotage';
import { liaison } from './lib/liaison';
import { autoriserSon } from './lib/retours';
import { ecrire, lire } from './lib/stockage';

function prenomDeDepart(): string {
  const dansUrl = new URLSearchParams(location.search).get('nom');
  if (dansUrl && dansUrl.trim()) {
    const nom = dansUrl.trim().slice(0, 20);
    ecrire('nom', nom);
    return nom;
  }
  const garde = lire<unknown>('nom', '');
  return typeof garde === 'string' ? garde : '';
}

export default function App() {
  const [nom, setNom] = useState(prenomDeDepart);
  const [pilotage, setPilotage] = useState(() => nom !== '');

  useEffect(() => {
    if (pilotage && nom) liaison.demarrer(nom);
  }, [pilotage, nom]);

  // Le son n'est permis qu'après un premier geste.
  useEffect(() => {
    const f = () => autoriserSon();
    document.addEventListener('pointerdown', f, { once: true, capture: true });
    return () => document.removeEventListener('pointerdown', f, { capture: true });
  }, []);

  if (!pilotage) {
    return (
      <Accueil
        nom={nom}
        onValider={(n) => {
          setNom(n);
          setPilotage(true);
        }}
      />
    );
  }
  return <Pilotage />;
}
