import "./globals.css";

export const metadata = {
  title: "Apuração 2º turno no mapa",
  description: "Votos para presidente por estado e cidade, com dados oficiais do TSE.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@75..125,400..800&display=swap" rel="stylesheet" />
      </head>
      <body>{children}</body>
    </html>
  );
}
