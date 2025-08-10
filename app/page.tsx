import { ProductGrid } from "@/components/product-grid"

export default function Home() {
  return (
    <main className="container mx-auto px-4 py-8">
      <div className="mb-8 text-center">
        <div className="flex items-center justify-center gap-4 mb-4">
          <div className="relative">
            <div className="w-16 h-16 bg-gradient-to-br from-purple-500 via-pink-500 to-blue-500 rounded-full flex items-center justify-center shadow-lg">
              <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center">
                <div className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                  KW
                </div>
              </div>
            </div>
            <div className="absolute -top-1 -right-1 w-6 h-6 bg-yellow-400 rounded-full flex items-center justify-center shadow-md">
              <span className="text-xs">⭐</span>
            </div>
            <div className="absolute -bottom-1 -left-1 w-5 h-5 bg-green-400 rounded-full flex items-center justify-center shadow-md">
              <span className="text-xs">🎨</span>
            </div>
          </div>
          <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 bg-clip-text text-transparent">
            Kids World
          </h1>
        </div>
        <div className="max-w-3xl mx-auto space-y-3">
          <p className="text-xl text-muted-foreground font-medium">Where Every Child's Dream Comes to Life! ✨</p>
          <p className="text-base text-muted-foreground leading-relaxed">
            Welcome to Kids World, your magical destination for extraordinary toys, educational treasures, and endless
            adventures! From spark-igniting STEM kits that turn little scientists into tomorrow's innovators, to cuddly
            companions that become lifelong friends, we carefully curate products that nurture creativity, inspire
            learning, and fuel imagination.
          </p>
          <p className="text-base text-muted-foreground leading-relaxed">
            Every item in our collection is chosen with love, designed to grow with your child, and built to create
            those precious moments of joy and discovery. Because at Kids World, we believe every child deserves products
            as unique and wonderful as their dreams! 🌟👶🎨🚀
          </p>
        </div>
      </div>
      <ProductGrid />
    </main>
  )
}
