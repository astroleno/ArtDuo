"use client";

import { ArrowLeft, ArrowRight, Info } from "lucide-react";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/lib/store';

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

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
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
Button.displayName = "Button";

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

const Carousel = React.forwardRef<
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
Carousel.displayName = "Carousel";

const CarouselContent = React.forwardRef<
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
CarouselContent.displayName = "CarouselContent";

const CarouselItem = React.forwardRef<
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
CarouselItem.displayName = "CarouselItem";

// Dialog implementation
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";

const Dialog = DialogPrimitive.Root;

const DialogTrigger = DialogPrimitive.Trigger;

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

const DialogContent = React.forwardRef<
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
DialogContent.displayName = DialogPrimitive.Content.displayName;

// 画作数据类型定义 - 保持原有的详细分析结构
type DetailKey =
  | 'emotionalJourney'
  | 'artisticInsights'
  | 'historicalStory'
  | 'personalConnection'
  | 'viewingExperience';

type Artwork = {
  id: string;
  title: string;
  artist: string;
  year: string;
  medium: string;
  dimensions: string;
  imageUrl: string;
  description: string;
  museum: string;
  detailedAnalysis: Record<DetailKey, string>;
  palette: {
    accent: string;
    ambient: string;
  };
};

const detailLabels: Record<DetailKey, string> = {
  emotionalJourney: '情绪流动',
  artisticInsights: '艺术洞察',
  historicalStory: '时代背景',
  personalConnection: '个人共鸣',
  viewingExperience: '观赏建议',
};

// 画作数据 - 保持原有的丰富内容
const ARTWORKS: Artwork[] = [
  {
    id: 'starry-night',
    title: '星夜',
    artist: '文森特·梵高',
    year: '1889',
    medium: '布面油画',
    dimensions: '73.7 × 92.1 cm',
    imageUrl: 'https://images.unsplash.com/photo-1541961017774-22349e4a1262?w=1400&h=1050&fit=crop',
    description: '梵高在圣雷米疗养院摹写内心的夜色，将旋转星轨与温暖乡镇叠合成起伏的节奏。',
    museum: '现代艺术博物馆 · MoMA',
    detailedAnalysis: {
      emotionalJourney: '星轨像放大的心跳，凝视越久越能感到躁动与平静交织，黑夜与光彼此牵引。',
      artisticInsights: '厚涂短促的笔触营造节奏，蓝与黄的碰撞引导视线游走，再落回村庄灯火。',
      historicalStory: '1889年完成，彼时他身在疗养院。梵高描绘的不是窗外原貌，而是心中的宇宙。',
      personalConnection: '若此刻也感到起伏，让这片天空提醒我们：光多半从最深的暗处升起。',
      viewingExperience: '先微退并放缓呼吸，再靠近观察笔触叠加，让节奏与自己的呼吸对话。',
    },
    palette: {
      accent: '#7dd3fc',
      ambient: 'rgba(125, 211, 252, 0.22)',
    },
  },
  {
    id: 'mona-lisa',
    title: '蒙娜丽莎',
    artist: '列奥纳多·达·芬奇',
    year: '1503',
    medium: '木板油画',
    dimensions: '77 × 53 cm',
    imageUrl: 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=1400&h=1050&fit=crop',
    description: '晕涂法柔化了光影，神秘的目光与微笑牵引观者进入静默而细腻的对话。',
    museum: '卢浮宫',
    detailedAnalysis: {
      emotionalJourney: '与她对视会感到被理解，那份轻柔的微笑像是对心绪的安抚。',
      artisticInsights: '达·芬奇用晕涂法抹去锐利线条，使光影像呼吸般自然。',
      historicalStory: '文艺复兴盛期的肖像代表，强调个体灵魂与观察的细致。',
      personalConnection: '也许你也拥有这样的表情——平静之下暗藏故事，为某个瞬间停留。',
      viewingExperience: '保持呼吸，与她静坐片刻，再细看背景的蜿蜒河流与淡雾。',
    },
    palette: {
      accent: '#fbbf24',
      ambient: 'rgba(251, 191, 36, 0.18)',
    },
  },
  {
    id: 'girl-with-pearl-earring',
    title: '戴珍珠耳环的少女',
    artist: '约翰内斯·维米尔',
    year: '1665',
    medium: '布面油画',
    dimensions: '44.5 × 39 cm',
    imageUrl: 'https://images.unsplash.com/photo-1578321272176-b7bbc0679853?w=1400&h=1050&fit=crop',
    description: '荷兰黄金时代的杰作，被称为"北方的蒙娜丽莎"。',
    museum: '莫瑞泰斯皇家美术馆',
    detailedAnalysis: {
      emotionalJourney: '少女回眸的瞬间被永恒地定格，她的眼神充满了神秘和诱惑。',
      artisticInsights: '维米尔对光线和色彩的精湛掌握，珍珠耳环在光线下闪闪发光。',
      historicalStory: '创作于荷兰黄金时代，体现了当时绘画技艺的巅峰水准。',
      personalConnection: '那种纯真而神秘的目光，仿佛能穿越时空与观者对话。',
      viewingExperience: '注意观察光线如何塑造面部轮廓，感受那颗珍珠的光泽变化。',
    },
    palette: {
      accent: '#f59e0b',
      ambient: 'rgba(245, 158, 11, 0.20)',
    },
  },
  {
    id: 'the-scream',
    title: '呐喊',
    artist: '爱德华·蒙克',
    year: '1893',
    medium: '蛋彩、油彩、粉彩',
    dimensions: '91 × 73.5 cm',
    imageUrl: 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=1400&h=1050&fit=crop',
    description: '表现主义的代表作，表达了现代人的焦虑和恐惧。',
    museum: '国家美术馆 · 奥斯陆',
    detailedAnalysis: {
      emotionalJourney: '扭曲的人物形象和血红色的天空表达了深深的焦虑和绝望。',
      artisticInsights: '色彩的强烈对比和扭曲的线条创造出震撼的视觉冲击。',
      historicalStory: '创作于1893年，是蒙克表现主义风格的代表作品。',
      personalConnection: '每个人内心都有过这样的时刻，感受到存在的焦虑与孤独。',
      viewingExperience: '让自己沉浸在那种强烈的情感表达中，感受艺术的力量。',
    },
    palette: {
      accent: '#ef4444',
      ambient: 'rgba(239, 68, 68, 0.25)',
    },
  },
  {
    id: 'impression-sunrise',
    title: '日出·印象',
    artist: '克劳德·莫奈',
    year: '1872',
    medium: '布面油画',
    dimensions: '48 × 63 cm',
    imageUrl: 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=1400&h=1050&fit=crop',
    description: '印象派运动的开山之作，描绘了勒阿弗尔港口的日出景象。',
    museum: '马蒙坦莫奈美术馆',
    detailedAnalysis: {
      emotionalJourney: '朦胧的晨光唤起内心对新一天的希望与期待。',
      artisticInsights: '莫奈用快速的笔触捕捉了光线在水面上的瞬息变化。',
      historicalStory: '这幅画给印象派运动命名，开启了现代艺术的新篇章。',
      personalConnection: '每个日出都是新的开始，带着无限的可能性。',
      viewingExperience: '观察色彩如何在画面中流动，感受光线的诗意表达。',
    },
    palette: {
      accent: '#f97316',
      ambient: 'rgba(249, 115, 22, 0.22)',
    },
  },
];

// 将画作数据转换为兼容格式
interface ArtworkItem {
  id: string;
  title: string;
  artist: string;
  year: string;
  description: string;
  image: string;
  details?: string;
  medium?: string;
  dimensions?: string;
  museum?: string;
  detailedAnalysis?: Record<DetailKey, string>;
  palette?: {
    accent: string;
    ambient: string;
  };
}

// 转换函数：将原始Artwork数据转换为ArtworkItem格式
const convertArtworkToItem = (artwork: Artwork): ArtworkItem => ({
  id: artwork.id,
  title: artwork.title,
  artist: artwork.artist,
  year: artwork.year,
  description: artwork.description,
  image: artwork.imageUrl,
  details: `${artwork.medium} · ${artwork.dimensions} · ${artwork.museum}\n\n${Object.values(artwork.detailedAnalysis).join('\n\n')}`,
  medium: artwork.medium,
  dimensions: artwork.dimensions,
  museum: artwork.museum,
  detailedAnalysis: artwork.detailedAnalysis,
  palette: artwork.palette,
});

const ImmersiveGallery = ({
  artworks = ARTWORKS.map(convertArtworkToItem)
}: { artworks?: ArtworkItem[] }) => {
  const router = useRouter();
  const { emotionInput } = useAppStore();
  
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
    <>
      {/* Gallery lighting effect */}
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'linear-gradient(to bottom, rgba(255,255,255,0.2), transparent, rgba(68,64,60,0.1))'
        }}
      ></div>
      
      {/* Header */}
      <header 
        className="relative z-20 px-8 pt-6 pb-4"
        style={{
          backgroundColor: 'transparent',
          backdropFilter: 'none',
          borderBottom: 'none',
        }}
      >
        <div className="mx-auto text-center relative" style={{ padding: '0 48px', maxWidth: '1200px', width: '100%' }}>
          <button 
            onClick={() => router.push('/gallery')}
            style={{ 
              color: '#57534e', 
              padding: '8px',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              position: 'absolute',
              left: '12px',
              top: '50%',
              transform: 'translateY(-50%)'
            }}
            className="hover:opacity-70 transition-opacity"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-lg font-semibold" style={{ color: '#1c1917', letterSpacing: '0.02em' }}>沉浸式画廊</h1>
            <p className="text-[11px] mt-1" style={{ color: '#57534e' }}>
              {emotionInput?.emotion ? `情绪策展 · ${emotionInput.emotion}` : '艺术探索之旅'}
            </p>
          </div>
        </div>
      </header>

      {/* Gallery Content */}
      <div className="flex-1 flex items-center justify-center p-8 relative z-10">
        <div className="w-full max-w-6xl">
          <Carousel
            setApi={setCarouselApi}
            opts={{
              align: "center",
              loop: true,
            }}
            className="w-full"
          >
            <CarouselContent className="ml-0">
              {artworks.map((artwork, index) => (
                <CarouselItem key={artwork.id} className="pl-0">
                  <div className="flex flex-row items-center justify-center min-h-[70vh]">
                    {/* Artwork Image */}
                    <div className="flex-shrink-0" style={{ marginRight: '140px' }}>
                      <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.6 }}
                        className="relative group"
                      >
                        {/* Gallery spotlight effect */}
                        <div 
                          className="absolute -inset-4 rounded-2xl blur-xl pointer-events-none group-hover:from-amber-300/40 transition-all duration-700"
                          style={{
                            background: 'radial-gradient(circle, rgba(255,218,185,0.3), transparent, transparent)'
                          }}
                        ></div>
                        <img
                          src={artwork.image}
                          alt={artwork.title}
                        className="relative z-10 w-full h-auto rounded-2xl shadow-2xl object-cover"
                          style={{
                            width: "480px",
                            height: "600px",
                            maxWidth: "480px",
                            maxHeight: "600px",
                            objectFit: "cover",
                            boxShadow: "0 20px 40px -12px rgba(0,0,0,0.25)"
                          }}
                        />
                        {/* Frame effect */}
                        <div 
                          className="absolute inset-0 rounded-2xl pointer-events-none"
                          style={{ 
                            border: '1px solid rgba(168,162,158,0.5)',
                            borderRadius: '1rem'
                          }}
                        ></div>
                      </motion.div>
                    </div>

                    {/* Artwork Information Card */}
                    <div className="flex-shrink-0" style={{ width: '420px' }}>
                      <motion.div
                        initial={{ opacity: 0, x: 50 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.6, delay: 0.2 }}
                        className="p-6"
                        style={{
                          width: '420px',
                          backgroundColor: 'rgba(255,255,255,0.95)',
                          border: '1px solid rgba(0,0,0,0.12)',
                          borderRadius: '0px',
                          boxShadow: "0 20px 40px -12px rgba(0,0,0,0.15)"
                        }}
                      >
                        <h2 className="text-xl font-semibold mb-1" style={{ color: '#1c1917' }}>
                          {artwork.title}
                        </h2>
                        <p className="text-sm mb-1" style={{ color: '#57534e' }}>
                          {artwork.artist}
                        </p>
                        <p className="text-[12px] mb-3" style={{ color: '#78716c' }}>
                          {artwork.year}
                        </p>
                        <p className="leading-relaxed mb-4 text-[13px]" style={{ color: '#44403c', width: '80%' }}>
                          {artwork.description}
                        </p>
                      </motion.div>
                    </div>
                  </div>
                </CarouselItem>
              ))}
            </CarouselContent>
          </Carousel>

      {/* Navigation Indicators */}
      <div className="flex justify-center mt-16" style={{ gap: '12px' }}>
        {artworks.map((_, index) => (
          <span
            key={index}
            aria-hidden="true"
            style={{
              display: 'inline-block',
              width: '8px',
              height: '8px',
              borderRadius: '9999px',
              backgroundColor: index === currentIndex ? 'rgba(0,0,0,0.55)' : 'rgba(0,0,0,0.18)'
            }}
          />
        ))}
      </div>
    </div>
  </div>

  {/* Footer */}
  <footer 
    className="py-6 relative z-10"
    style={{
      backgroundColor: 'rgba(68,64,60,0.95)',
      backdropFilter: 'blur(8px)',
      color: '#d6d3d1'
    }}
  >
    <div className="container mx-auto px-4 text-center">
      <p className="text-xs tracking-wide" style={{ opacity: '0.7' }}>
        沉浸式艺术画廊 · 2024
      </p>
    </div>
  </footer>
    </>
  );
};

export default function ImmersiveGalleryPage() {
  return (
    <div 
      className="min-h-screen flex flex-col relative"
      style={{ 
        background: 'linear-gradient(to bottom, #f5f5f4, #e7e5e4, #d6d3d1)', // stone-100 to stone-300
        color: '#1c1917' // stone-900 
      }}
    >
      <ImmersiveGallery />
    </div>
  );
}