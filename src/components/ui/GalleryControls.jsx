import Icon from "@components/ui/Icon";
import { galleryStatus } from "@constants/galleryStatus";

export default function GalleryControls({
  cards = [],
  current = 0,
  idPrefix = "gallery",
  status = "playing",
  isRunning = false,
  videoDuration = null,
  onSelect,
  onToggle,
  onFillEnd,
  barRef,
  blobRef,
  dotBubbleRef,
  dotBackgroundRef,
  dotListRef,
  registerDot,
  playBubbleRef,
  playBackgroundRef,
}) {
  return (
    <div
      ref={barRef}
      className="group sticky bottom-8 z-10 mx-auto mt-8 flex w-fit items-center gap-3"
    >
      <span
        ref={blobRef}
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-1/2 rounded-full bg-[#E4E2E5]/70 opacity-0 backdrop-blur-md
        dark:bg-[#28282B]/70"
      />

      <div
        ref={dotBubbleRef}
        className="relative isolate flex h-14 items-center px-4"
      >
        <span
          ref={dotBackgroundRef}
          aria-hidden="true"
          style={{ backdropFilter: "blur(calc(12px * (2 - var(--alpha, 1))))" }}
          className="absolute top-1/2 left-1/2 -z-10 rounded-full bg-[#E4E2E5]/70 opacity-0
          group-data-[activated=true]:opacity-100
          dark:bg-[#28282B]/70"
        />

        <ul
          ref={dotListRef}
          role="tablist"
          aria-label="Tarjetas de la galería"
          className="flex items-center"
        >
          {cards.map((card, index) => (
            <li
              key={card.title}
              ref={registerDot(index)}
              className="flex scale-50 opacity-0 transition-opacity duration-100 ease-in
              group-data-[activated=true]:scale-100 group-data-[activated=true]:opacity-100 group-data-[activated=true]:delay-740ms"
            >
              <button
                type="button"
                role="tab"
                id={`${idPrefix}-dot-${index}`}
                aria-selected={current === index}
                aria-controls={`${idPrefix}-card-${index}`}
                aria-label={card.title}
                onClick={() => onSelect(index)}
                style={{
                  "--item-index": index,
                  minWidth:
                    "calc(8px + 40px * max(0, 1 - max(var(--item-index) - var(--autoplay-progress), var(--autoplay-progress) - var(--item-index))) * var(--progress-intro))",
                }}
                className={`relative mx-2 h-2 w-2 max-w-12 overflow-hidden rounded-full transition-colors duration-200
                ${
                  current === index
                    ? "bg-[#75777E]/40 dark:bg-[#7E8088]/40"
                    : `bg-[#75777E]/60
                      hover:bg-[#75777E]
                      dark:bg-[#7E8088]/60 dark:hover:bg-[#7E8088]`
                }`}
              >
                {current === index && (
                  <span
                    aria-hidden="true"
                    onAnimationEnd={onFillEnd}
                    style={
                      videoDuration
                        ? { animationDuration: `${videoDuration}s` }
                        : undefined
                    }
                    className={`absolute inset-y-0 left-0 animate-dot-fill rounded-full bg-black
                    motion-reduce:[animation-duration:4s]!
                    dark:bg-[#E4E2E5]
                    ${isRunning ? "" : "[animation-play-state:paused]"}`}
                  />
                )}
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div
        ref={playBubbleRef}
        className="relative isolate flex size-14 items-center justify-center"
      >
        <span
          ref={playBackgroundRef}
          aria-hidden="true"
          style={{ backdropFilter: "blur(calc(12px * (2 - var(--alpha, 1))))" }}
          className="absolute top-1/2 left-1/2 -z-10 rounded-full bg-[#E4E2E5]/70 opacity-0
          group-data-[activated=true]:opacity-100
          dark:bg-[#28282B]/70"
        />

        <button
          type="button"
          onClick={onToggle}
          aria-label={galleryStatus[status].label}
          className="flex size-14 items-center justify-center rounded-full text-black/70 transition-colors duration-200
          hover:text-black
          dark:text-[#E4E2E5]/70 dark:hover:text-[#E4E2E5]"
        >
          <span
            className="flex scale-50 opacity-0 transition-[opacity,scale] duration-200 ease-out
            group-data-[activated=true]:scale-100 group-data-[activated=true]:opacity-100 group-data-[activated=true]:delay-940ms"
          >
            <Icon name={galleryStatus[status].icon} fill size={30} />
          </span>
        </button>
      </div>
    </div>
  );
}
