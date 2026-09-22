import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";

interface UseFetchListReturn<T> {
  items: T[];
  setItems: Dispatch<SetStateAction<T[]>>;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

export function useFetchList<T>(fetcher: () => Promise<T[]>, errorMessage: string): UseFetchListReturn<T> {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const fetcherRef = useRef(fetcher);

  useEffect(() => {
    fetcherRef.current = fetcher;
  });

  useEffect(() => {
    let active = true;
    fetcherRef.current()
      .then((data) => {
        if (!active) return;
        setItems(data);
        // Limpa no sucesso: uma falha transitória deixava a faixa vermelha na tela
        // para sempre, mesmo com a lista já carregada depois.
        setError(null);
      })
      .catch(() => {
        if (active) setError(errorMessage);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [refreshKey, errorMessage]);

  const reload = useCallback(() => {
    setError(null);
    setRefreshKey((k) => k + 1);
  }, []);

  return { items, setItems, loading, error, reload };
}
