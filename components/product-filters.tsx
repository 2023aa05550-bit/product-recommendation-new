"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { X, Filter, Search, SlidersHorizontal, ChevronDown } from "lucide-react"

interface FilterState {
  category: string
  minPrice: number
  maxPrice: number
  search: string
  sortBy: "name" | "popularity" | "price" | "feedback"
  sortOrder: "asc" | "desc"
}

interface ProductFiltersProps {
  filters: FilterState
  onFiltersChange: (filters: FilterState) => void
  categories: string[]
  priceRange: { min: number; max: number }
  isLoading?: boolean
  isMobile?: boolean
  onToggleMobileFilters?: () => void
}

export function ProductFilters({
  filters,
  onFiltersChange,
  categories,
  priceRange,
  isLoading = false,
  isMobile = false,
  onToggleMobileFilters,
}: ProductFiltersProps) {
  const [localPriceRange, setLocalPriceRange] = useState([filters.minPrice, filters.maxPrice])

  // Add useEffect to sync local price range with props
  useEffect(() => {
    setLocalPriceRange([filters.minPrice, filters.maxPrice])
  }, [filters.minPrice, filters.maxPrice])

  const handleFilterChange = (key: keyof FilterState, value: any) => {
    onFiltersChange({ ...filters, [key]: value })
  }

  // Update the handlePriceRangeChange function
  const handlePriceRangeChange = (values: number[]) => {
    setLocalPriceRange(values)
    // Debounce the filter update
    const timeoutId = setTimeout(() => {
      onFiltersChange({
        ...filters,
        minPrice: values[0],
        maxPrice: values[1],
      })
    }, 300)

    return () => clearTimeout(timeoutId)
  }

  const clearFilters = () => {
    const clearedFilters: FilterState = {
      category: "all",
      minPrice: priceRange.min,
      maxPrice: priceRange.max,
      search: "",
      sortBy: "popularity",
      sortOrder: "desc",
    }
    setLocalPriceRange([priceRange.min, priceRange.max])
    onFiltersChange(clearedFilters)
  }

  const hasActiveFilters =
    filters.category !== "all" ||
    filters.search !== "" ||
    filters.minPrice !== priceRange.min ||
    filters.maxPrice !== priceRange.max

  // Get the display name for the selected category
  const getSelectedCategoryDisplay = () => {
    if (filters.category === "all") return "All Categories"
    const selectedCategory = categories.find((cat) => cat.toLowerCase() === filters.category.toLowerCase())
    return selectedCategory || filters.category
  }

  const FilterContent = () => (
    <div className="space-y-4">
      {/* Search */}
      <div className="space-y-1.5">
        <Label htmlFor="search" className="text-xs font-medium text-slate-700">
          Search Products
        </Label>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            id="search"
            placeholder="Search products..."
            value={filters.search}
            onChange={(e) => handleFilterChange("search", e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>
      </div>

      {/* Categories Dropdown */}
      <div className="space-y-1.5">
        <Label className="text-xs font-medium text-slate-700">
          Category{" "}
          {categories.length > 0 && <span className="text-muted-foreground">({categories.length} available)</span>}
        </Label>
        <Select value={filters.category} onValueChange={(value) => handleFilterChange("category", value)}>
          <SelectTrigger className="h-8 text-sm">
            <SelectValue>
              <div className="flex items-center justify-between w-full">
                <span className="truncate">{getSelectedCategoryDisplay()}</span>
                <ChevronDown className="h-3 w-3 opacity-50" />
              </div>
            </SelectValue>
          </SelectTrigger>
          <SelectContent className="max-h-60">
            <SelectItem value="all" className="font-medium">
              <div className="flex items-center">
                <span>All Categories</span>
                <Badge variant="secondary" className="ml-2 text-xs">
                  {categories.length}
                </Badge>
              </div>
            </SelectItem>
            <div className="border-t my-1" />
            {categories.sort().map((category) => (
              <SelectItem key={category} value={category.toLowerCase()} className="text-sm">
                <div className="flex items-center justify-between w-full">
                  <span className="truncate" title={category}>
                    {category}
                  </span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Debug info - remove this after testing */}
        {process.env.NODE_ENV === "development" && (
          <div className="text-xs text-muted-foreground">
            Selected: {filters.category} | Available: {categories.slice(0, 5).join(", ")}
            {categories.length > 5 ? "..." : ""}
          </div>
        )}
      </div>

      {/* Sort Options Row */}
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-slate-700">Sort By</Label>
          <Select value={filters.sortBy} onValueChange={(value: any) => handleFilterChange("sortBy", value)}>
            <SelectTrigger className="h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="popularity">Popular</SelectItem>
              <SelectItem value="name">Name</SelectItem>
              <SelectItem value="price">Price</SelectItem>
              <SelectItem value="feedback">Rating</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-slate-700">Order</Label>
          <Select value={filters.sortOrder} onValueChange={(value: any) => handleFilterChange("sortOrder", value)}>
            <SelectTrigger className="h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="desc">High to Low</SelectItem>
              <SelectItem value="asc">Low to High</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Price Range */}
      <div className="space-y-2">
        <Label className="text-xs font-medium text-slate-700">Price Range</Label>
        <div className="px-1">
          <Slider
            value={localPriceRange}
            onValueChange={handlePriceRangeChange}
            max={priceRange.max}
            min={priceRange.min}
            step={1}
            className="w-full"
          />
        </div>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>${localPriceRange[0]}</span>
          <span>${localPriceRange[1]}</span>
        </div>
      </div>

      {/* Active Filters */}
      {hasActiveFilters && (
        <div className="space-y-2 pt-2 border-t">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-medium text-slate-700">Active Filters</Label>
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="h-auto p-1 text-xs text-slate-500 hover:text-slate-700"
            >
              Clear All
            </Button>
          </div>
          <div className="flex flex-wrap gap-1">
            {filters.category !== "all" && (
              <Badge variant="secondary" className="text-xs h-5 px-1.5">
                <span className="truncate max-w-20">{getSelectedCategoryDisplay()}</span>
                <X
                  className="ml-1 h-2.5 w-2.5 cursor-pointer flex-shrink-0"
                  onClick={() => handleFilterChange("category", "all")}
                />
              </Badge>
            )}
            {filters.search && (
              <Badge variant="secondary" className="text-xs h-5 px-1.5">
                <span className="truncate max-w-16">"{filters.search}"</span>
                <X
                  className="ml-1 h-2.5 w-2.5 cursor-pointer flex-shrink-0"
                  onClick={() => handleFilterChange("search", "")}
                />
              </Badge>
            )}
            {(filters.minPrice !== priceRange.min || filters.maxPrice !== priceRange.max) && (
              <Badge variant="secondary" className="text-xs h-5 px-1.5">
                ${filters.minPrice}-${filters.maxPrice}
                <X
                  className="ml-1 h-2.5 w-2.5 cursor-pointer flex-shrink-0"
                  onClick={() => {
                    const newRange = [priceRange.min, priceRange.max]
                    setLocalPriceRange(newRange)
                    onFiltersChange({ ...filters, minPrice: priceRange.min, maxPrice: priceRange.max })
                  }}
                />
              </Badge>
            )}
          </div>
        </div>
      )}
    </div>
  )

  if (isMobile) {
    return (
      <div className="lg:hidden">
        <Button
          variant="outline"
          size="sm"
          onClick={onToggleMobileFilters}
          className="flex items-center gap-2 mb-4 bg-transparent"
        >
          <SlidersHorizontal className="h-4 w-4" />
          Filters
          {hasActiveFilters && (
            <Badge variant="secondary" className="ml-1 text-xs">
              {[
                filters.category !== "all" ? 1 : 0,
                filters.search ? 1 : 0,
                filters.minPrice !== priceRange.min || filters.maxPrice !== priceRange.max ? 1 : 0,
              ].reduce((a, b) => a + b, 0)}
            </Badge>
          )}
        </Button>
      </div>
    )
  }

  return (
    <Card className="sticky top-4">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Filter className="h-4 w-4" />
          Filters
          {categories.length > 0 && (
            <Badge variant="outline" className="text-xs">
              {categories.length} categories
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <FilterContent />
      </CardContent>
    </Card>
  )
}
