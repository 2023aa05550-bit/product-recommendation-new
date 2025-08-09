import { ProductGrid } from "@/components/product-grid"

export default function Home() {
  return (
    <main className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight mb-2">Our Products</h1>
        <p className="text-muted-foreground">Discover our amazing collection of products</p>
      </div>
      <ProductGrid />
    </main>
  )
}
