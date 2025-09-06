export const metadata = {
  title: "Payment Format Converter",
  description: "Convert payment messages between different formats using MongoDB-driven rules and AI",
};

export default function ConverterLayout({ children }) {
  return (
    <div className="converter-layout">
      {children}
    </div>
  );
}