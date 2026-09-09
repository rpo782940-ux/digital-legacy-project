import { createFileRoute, notFound } from "@tanstack/react-router";
import { SiteLayout } from "@/components/SiteLayout";
import { ProductPage } from "@/components/ProductPage";
import { productQuery } from "@/lib/catalog-queries";
import { productHead } from "@/lib/product-head";

export const Route = createFileRoute("/uk/p/$slug")({
  loader: async ({ params, context }) => {
    const data = await context.queryClient.ensureQueryData(productQuery(params.slug, "uk"));
    if (!data) throw notFound();
    const p = data.product;
    return {
      name: p.name,
      description: p.description,
      image: p.image,
      price: p.price,
      inStock: p.inStock,
      brand: p.brand,
    };
  },
  head: ({ loaderData, params }) => productHead(loaderData, params.slug, "uk"),
  errorComponent: ({ error }) => (
    <div role="alert" className="container-page py-20 text-center">
      {error.message}
    </div>
  ),
  notFoundComponent: () => <div className="container-page py-20 text-center">404</div>,
  component: () => {
    const { slug } = Route.useParams();
    return (
      <SiteLayout lang="uk">
        <ProductPage slug={slug} lang="uk" />
      </SiteLayout>
    );
  },
});
