"use client";

import { ArrowLeft, ArrowRight, Info } from "lucide-react";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

import { Button } from "@/components/ui/button";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
} from "@/components/ui/carousel";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";

// Utility function for className merging
function cn(...classes: (string | undefined | null | boolean)[]): string {
  return classes.filter(Boolean).join(' ');
}

// Button component implementation
import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline:
          "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const ButtonComponent = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
ButtonComponent.displayName = "Button";

// Carousel implementation
import useEmblaCarousel, {
  type UseEmblaCarouselType,
} from "embla-carousel-react";

type CarouselApi = UseEmblaCarouselType[1];
type UseCarouselParameters = Parameters<typeof useEmblaCarousel>;
type CarouselOptions = UseCarouselParameters[0];
type CarouselPlugin = UseCarouselParameters[1];

type CarouselProps = {
  opts?: CarouselOptions;
  plugins?: CarouselPlugin;
  orientation?: "horizontal" | "vertical";
  setApi?: (api: CarouselApi) => void;
};

type CarouselContextProps = {
  carouselRef: ReturnType<typeof useEmblaCarousel>[0];
  api: ReturnType<typeof useEmblaCarousel>[1];
  scrollPrev: () => void;
  scrollNext: () => void;
  canScrollPrev: boolean;
  canScrollNext: boolean;
} & CarouselProps;

const CarouselContext = React.createContext<CarouselContextProps | null>(null);

function useCarousel() {
  const context = React.useContext(CarouselContext);

  if (!context) {
    throw new Error("useCarousel must be used within a <Carousel />");
  }

  return context;
}

const CarouselComponent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & CarouselProps
>(
  (
    {
      orientation = "horizontal",
      opts,
      setApi,
      plugins,
      className,
      children,
      ...props
    },
    ref,
  ) => {
    const [carouselRef, api] = useEmblaCarousel(
      {
        ...opts,
        axis: orientation === "horizontal" ? "x" : "y",
      },
      plugins,
    );
    const [canScrollPrev, setCanScrollPrev] = React.useState(false);
    const [canScrollNext, setCanScrollNext] = React.useState(false);

    const onSelect = React.useCallback((api: CarouselApi) => {
      if (!api) {
        return;
      }

      setCanScrollPrev(api.canScrollPrev());
      setCanScrollNext(api.canScrollNext());
    }, []);

    const scrollPrev = React.useCallback(() => {
      api?.scrollPrev();
    }, [api]);

    const scrollNext = React.useCallback(() => {
      api?.scrollNext();
    }, [api]);

    const handleKeyDown = React.useCallback(
      (event: React.KeyboardEvent<HTMLDivElement>) => {
        if (event.key === "ArrowLeft") {
          event.preventDefault();
          scrollPrev();
        } else if (event.key === "ArrowRight") {
          event.preventDefault();
          scrollNext();
        }
      },
      [scrollPrev, scrollNext],
    );

    React.useEffect(() => {
      if (!api || !setApi) {
        return;
      }

      setApi(api);
    }, [api, setApi]);

    React.useEffect(() => {
      if (!api) {
        return;
      }

      onSelect(api);
      api.on("reInit", onSelect);
      api.on("select", onSelect);

      return () => {
        api?.off("select", onSelect);
      };
    }, [api, onSelect]);

    return (
      <CarouselContext.Provider
        value={{
          carouselRef,
          api: api,
          opts,
          orientation:
            orientation || (opts?.axis === "y" ? "vertical" : "horizontal"),
          scrollPrev,
          scrollNext,
          canScrollPrev,
          canScrollNext,
        }}
      >
        <div
          ref={ref}
          onKeyDownCapture={handleKeyDown}
          className={cn("relative", className)}
          role="region"
          aria-roledescription="carousel"
          {...props}
        >
          {children}
        </div>
      </CarouselContext.Provider>
    );
  },
);
CarouselComponent.displayName = "Carousel";

const CarouselContentComponent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => {
  const { carouselRef, orientation } = useCarousel();

  return (
    <div ref={carouselRef} className="overflow-hidden">
      <div
        ref={ref}
        className={cn(
          "flex",
          orientation === "horizontal" ? "-ml-4" : "-mt-4 flex-col",
          className,
        )}
        {...props}
      />
    </div>
  );
});
CarouselContentComponent.displayName = "CarouselContent";

const CarouselItemComponent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => {
  const { orientation } = useCarousel();

  return (
    <div
      ref={ref}
      role="group"
      aria-roledescription="slide"
      className={cn(
        "min-w-0 shrink-0 grow-0 basis-full",
        orientation === "horizontal" ? "pl-4" : "pt-4",
        className,
      )}
      {...props}
    />
  );
});
CarouselItemComponent.displayName = "CarouselItem";

// Dialog implementation
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";

const DialogComponent = DialogPrimitive.Root;

const DialogTriggerComponent = DialogPrimitive.Trigger;

const DialogPortal = DialogPrimitive.Portal;

const DialogClose = DialogPrimitive.Close;

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className
    )}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

const DialogContentComponent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        "fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:rounded-lg",
        className
      )}
      {...props}
    >
      {children}
      <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
        <X className="h-4 w-4" />
        <span className="sr-only">Close</span>
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPortal>
));
DialogContentComponent.displayName = DialogPrimitive.Content.displayName;

interface ArtworkItem {
  id: string;
  title: string;
  artist: string;
  year: string;
  description: string;
  image: string;
  details?: string;
}

interface ImmersiveGalleryProps {
  artworks?: ArtworkItem[];
}

const ImmersiveGallery = ({
  artworks = [
    {
      id: "artwork-1",
      title: "星夜",
      artist: "文森特·梵高",
      year: "1889",
      description: "后印象派杰作，描绘了夜空中旋转的星云和明亮的月亮。",
      image: "https://images.unsplash.com/photo-1541961017774-22349e4a1262?w=800&q=80",
      details: "这幅画作于1889年6月，是梵高在圣雷米精神病院期间创作的。画面展现了一个充满动感的夜空，旋转的云朵和闪烁的星星创造出一种梦幻般的氛围。前景中的柏树像火焰一样向上伸展，连接着大地与天空。"
    },
    {
      id: "artwork-2", 
      title: "蒙娜丽莎",
      artist: "列奥纳多·达·芬奇",
      year: "1503-1519",
      description: "文艺复兴时期最著名的肖像画，以其神秘的微笑而闻名。",
      image: "https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=800&q=80",
      details: "这幅肖像画被认为是达·芬奇的杰作，画中女子的神秘微笑和直视观者的目光创造了一种永恒的魅力。画作使用了达·芬奇独特的晕涂法技巧，创造出柔和的光影效果。"
    },
    {
      id: "artwork-3",
      title: "戴珍珠耳环的少女",
      artist: "约翰内斯·维米尔",
      year: "1665",
      description: "荷兰黄金时代的杰作，被称为'北方的蒙娜丽莎'。",
      image: "https://images.unsplash.com/photo-1578321272176-b7bbc0679853?w=800&q=80",
      details: "这幅画展现了维米尔对光线和色彩的精湛掌握。少女回眸的瞬间被永恒地定格，她的眼神充满了神秘和诱惑。珍珠耳环在光线下闪闪发光，成为整幅画的焦点。"
    },
    {
      id: "artwork-4",
      title: "呐喊",
      artist: "爱德华·蒙克",
      year: "1893",
      description: "表现主义的代表作，表达了现代人的焦虑和恐惧。",
      image: "https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=800&q=80",
      details: "这幅画创作于1893年，是蒙克表现主义风格的代表作。扭曲的人物形象和血红色的天空表达了深深的焦虑和绝望。这件作品成为了20世纪艺术的标志性形象。"
    },
    {
      id: "artwork-5",
      title: "日出·印象",
      artist: "克劳德·莫奈",
      year: "1872",
      description: "印象派运动的开山之作，描绘了勒阿弗尔港口的日出景象。",
      image: "https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=800&q=80",
      details: "这幅画作于1872年，描绘了勒阿弗尔港口的日出景象。莫奈用快速的笔触捕捉了光线在水面上的变化，创造出一种朦胧的印象效果。这幅画给印象派运动命名，开启了现代艺术的新篇章。"
    }
  ]
}: ImmersiveGalleryProps) => {
  const [carouselApi, setCarouselApi] = useState<CarouselApi>();
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (!carouselApi) {
      return;
    }
    
    const updateSelection = () => {
      setCanScrollPrev(carouselApi.canScrollPrev());
      setCanScrollNext(carouselApi.canScrollNext());
      setCurrentIndex(carouselApi.selectedScrollSnap());
    };
    
    updateSelection();
    carouselApi.on("select", updateSelection);
    
    return () => {
      carouselApi.off("select", updateSelection);
    };
  }, [carouselApi]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft" && canScrollPrev) {
        carouselApi?.scrollPrev();
      } else if (event.key === "ArrowRight" && canScrollNext) {
        carouselApi?.scrollNext();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [carouselApi, canScrollPrev, canScrollNext]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-stone-100 via-stone-200 to-stone-300 flex flex-col relative">
      {/* Gallery lighting effect */}
      <div className="absolute inset-0 bg-gradient-to-b from-white/20 via-transparent to-stone-900/10 pointer-events-none"></div>
      {/* Gallery Content */}
      <div className="flex-1 flex items-center justify-center p-8 relative z-10">
        <div className="w-full max-w-6xl">
          <CarouselComponent
            setApi={setCarouselApi}
            opts={{
              align: "center",
              loop: true,
            }}
            className="w-full"
          >
            <CarouselContentComponent className="ml-0">
              {artworks.map((artwork, index) => (
                <CarouselItemComponent key={artwork.id} className="pl-0">
                  <div className="flex flex-col lg:flex-row items-center gap-8 lg:gap-16">
                    {/* Artwork Image */}
                    <div className="w-full lg:w-1/2 flex justify-center">
                      <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.6 }}
                        className="relative"
                      >
                        {/* Gallery spotlight effect */}
                        <div className="absolute -inset-8 bg-gradient-radial from-white/30 via-white/10 to-transparent rounded-full blur-xl pointer-events-none"></div>
                        <img
                          src={artwork.image}
                          alt={artwork.title}
                          className="max-w-full max-h-[70vh] object-contain relative z-10 shadow-2xl"
                        />
                        {/* Bottom shadow */}
                        <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-3/4 h-4 bg-stone-900/20 blur-lg rounded-full"></div>
                      </motion.div>
                    </div>

                    {/* Artwork Information Card */}
                    <div className="w-full lg:w-1/2">
                      <motion.div
                        initial={{ opacity: 0, x: 50 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.6, delay: 0.2 }}
                        className="bg-white/80 backdrop-blur-sm p-6 shadow-xl border-0 relative"
                      >
                        {/* Card spotlight effect */}
                        <div className="absolute -inset-2 bg-gradient-radial from-white/40 via-white/10 to-transparent rounded-lg blur-md pointer-events-none"></div>
                        <div className="relative z-10">
                          <h2 className="text-2xl font-bold text-stone-800 mb-1">
                            {artwork.title}
                          </h2>
                          <p className="text-lg text-stone-600 mb-1">
                            {artwork.artist}
                          </p>
                          <p className="text-sm text-stone-500 mb-4">
                            {artwork.year}
                          </p>
                          <p className="text-stone-700 leading-relaxed mb-6 text-sm">
                            {artwork.description}
                          </p>
                        
                          {artwork.details && (
                            <DialogComponent>
                              <DialogTriggerComponent asChild>
                                <button className="text-stone-600 hover:text-stone-800 text-xs font-medium underline underline-offset-4 transition-colors">
                                  了解更多
                                </button>
                              </DialogTriggerComponent>
                              <DialogContentComponent className="max-w-2xl bg-white/90 backdrop-blur-sm">
                                <div className="space-y-4">
                                  <h3 className="text-2xl font-bold text-stone-800">
                                    {artwork.title}
                                  </h3>
                                  <div className="text-stone-600">
                                    <p><strong>艺术家:</strong> {artwork.artist}</p>
                                    <p><strong>创作年代:</strong> {artwork.year}</p>
                                  </div>
                                  <p className="text-stone-700 leading-relaxed">
                                    {artwork.details}
                                  </p>
                                </div>
                              </DialogContentComponent>
                            </DialogComponent>
                          )}
                        </div>
                      </motion.div>
                    </div>
                  </div>
                </CarouselItemComponent>
              ))}
            </CarouselContentComponent>
          </CarouselComponent>

          {/* Navigation Indicators */}
          <div className="flex justify-center gap-2 mt-12">
            {artworks.map((_, index) => (
              <button
                key={index}
                className={cn(
                  "w-2 h-2 rounded-full transition-all duration-300",
                  currentIndex === index ? "bg-stone-700 scale-125" : "bg-stone-400 hover:bg-stone-600"
                )}
                onClick={() => carouselApi?.scrollTo(index)}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-stone-900/95 backdrop-blur-sm text-stone-300 py-6 relative z-10">
        <div className="container mx-auto px-4 text-center">
          <p className="text-xs tracking-wide opacity-70">
            沉浸式艺术画廊 · 2024
          </p>
        </div>
      </footer>
    </div>
  );
};

export default ImmersiveGallery;