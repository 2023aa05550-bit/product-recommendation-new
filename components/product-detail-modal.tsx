"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Minus, Plus, ShoppingCart, Star, ThumbsUp, Heart, Share2 } from "lucide-react"

interface Product {
  [key: string]: any
}

interface CartItem {
  id: string
  name: string
  price: number
  quantity: number
  image: string
}

interface ProductDetailModalProps {
  product: Product | null
  isOpen: boolean
  onClose: () => void
  onAddToCart: (product: Product, quantity: number) => void
  similarProducts: Product[]
  onProductClick: (product: Product) => void
}

export function ProductDetailModal({
  product,
  isOpen,
  onClose,
  onAddToCart,
  similarProducts,
  onProductClick,
}: ProductDetailModalProps) {
  const [quantity, setQuantity] = useState(1)

  useEffect(() => {
    if (isOpen) {
      setQuantity(1)
    }
  }, [isOpen, product])

  if (!product) return null

  const handleQuantityChange = (change: number) => {
    const newQuantity = Math.max(1, Math.min(product.stock || 99, quantity + change))
    setQuantity(newQuantity)
  }

  const handleAddToCart = () => {
    onAddToCart(product, quantity)
    onClose()
  }

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: product.name,
        text: `Check out this product: ${product.name}`,
        url: window.location.href,
      })
    } else {
      navigator.clipboard.writeText(`${product.name} - ${window.location.href}`)
      alert("Product link copied to clipboard!")
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="sr-only">Product Details</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Product Image */}
          <div className="space-y-4">
            <div className="aspect-square overflow-hidden rounded-lg bg-gradient-to-br from-slate-100 to-slate-200">
              <img
                src={product.image || "/placeholder.svg"}
                alt={product.name}
                className="w-full h-full object-contain"
                onError={(e) => {
                  const target = e.target as HTMLImageElement
                  target.src = `/placeholder.svg?height=400&width=400&query=${encodeURIComponent(product.name)}`
                }}
              />
            </div>
          </div>

          {/* Product Info */}
          <div className="space-y-6">
            {/* Title and Price */}
            <div>
              <h1 className="text-2xl font-bold text-slate-900 mb-2">{product.name}</h1>
              <div className="flex items-center gap-4 mb-4">
                <span className="text-3xl font-bold text-primary">${product.price}</span>
                <div className="flex items-center gap-1">
                  <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                  <span className="font-medium">{product.rating}</span>
                </div>
              </div>
            </div>

            {/* Categories */}
            <div>
              <h3 className="text-sm font-medium text-slate-700 mb-2">Categories</h3>
              <div className="flex flex-wrap gap-2">
                {product.categories?.map((category: string, index: number) => (
                  <Badge key={index} variant="secondary" className="text-xs">
                    {category}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Description */}
            <div>
              <h3 className="text-sm font-medium text-slate-700 mb-2">Description</h3>
              <p className="text-sm text-slate-600 leading-relaxed">{product.description}</p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-2">
                <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                <span className="text-sm font-medium">{product.popularity} purchases</span>
              </div>
              <div className="flex items-center gap-2">
                <ThumbsUp className="h-4 w-4 text-green-600" />
                <span className="text-sm font-medium">{product.net_feedback} reviews</span>
              </div>
            </div>

            {/* Stock Status */}
            <div>
              {product.stock <= 10 && (
                <Badge variant="destructive" className="mb-2">
                  Only {product.stock} left in stock
                </Badge>
              )}
            </div>

            {/* Quantity Selector */}
            <div>
              <h3 className="text-sm font-medium text-slate-700 mb-2">Quantity</h3>
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleQuantityChange(-1)}
                  disabled={quantity <= 1}
                  className="h-8 w-8 p-0"
                >
                  <Minus className="h-3 w-3" />
                </Button>
                <span className="font-medium text-lg w-8 text-center">{quantity}</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleQuantityChange(1)}
                  disabled={quantity >= (product.stock || 99)}
                  className="h-8 w-8 p-0"
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <Button onClick={handleAddToCart} className="flex-1 flex items-center gap-2">
                <ShoppingCart className="h-4 w-4" />
                Add to Cart
              </Button>
              <Button variant="outline" size="sm" className="flex items-center gap-2 bg-transparent">
                <Heart className="h-4 w-4" />
                Save
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleShare}
                className="flex items-center gap-2 bg-transparent"
              >
                <Share2 className="h-4 w-4" />
                Share
              </Button>
            </div>
          </div>
        </div>

        {/* Similar Products */}
        {similarProducts.length > 0 && (
          <div className="mt-8 pt-6 border-t">
            <h3 className="text-lg font-semibold mb-4">Similar Products</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {similarProducts.slice(0, 4).map((similarProduct) => (
                <Card
                  key={similarProduct.id}
                  className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => onProductClick(similarProduct)}
                >
                  <CardContent className="p-3">
                    <div className="aspect-square overflow-hidden rounded-md bg-gradient-to-br from-slate-100 to-slate-200 mb-2">
                      <img
                        src={similarProduct.image || "/placeholder.svg"}
                        alt={similarProduct.name}
                        className="w-full h-full object-contain"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement
                          target.src = `/placeholder.svg?height=200&width=200&query=${encodeURIComponent(similarProduct.name)}`
                        }}
                      />
                    </div>
                    <h4 className="font-medium text-sm line-clamp-2 mb-1">{similarProduct.name}</h4>
                    <p className="text-primary font-bold text-sm">${similarProduct.price}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
