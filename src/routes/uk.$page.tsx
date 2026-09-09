import { createFileRoute } from "@tanstack/react-router";
import { catalogSearchSchema } from "@/lib/catalog-search";
import { pageHead, pageLoader, renderPage } from "@/lib/page-render";

export const Route = createFileRoute("/uk/$page")({
  validateSearch: catalogSearchSchema,
  head: ({ params }) => pageHead(params.page.replace(/\.php$/, ""), "uk"),
  loader: ({ params, context }) =>
    pageLoader(params.page.replace(/\.php$/, ""), "uk", context.queryClient),
  errorComponent: ({ error }) => (
    <div role="alert" className="container-page py-20 text-center">
      {error.message}
    </div>
  ),
  notFoundComponent: () => <div className="container-page py-20 text-center">404</div>,
  component: () => {
    const { page } = Route.useParams();
    return renderPage(page.replace(/\.php$/, ""), "uk");
  },
});
