import { EmptyState } from "@/components/ui/EmptyState";

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center px-4">
      <EmptyState art="search" title="Такой страницы нет" text="Возможно, место переехало или ссылка устарела. Давайте найдём что-нибудь классное!" action={{ href: "/", label: "На главную" }} />
    </main>
  );
}
