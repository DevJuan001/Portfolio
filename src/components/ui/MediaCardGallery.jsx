export default function MediaCardGallery({
  cards = [],
  current = 0,
  idPrefix = "gallery",
  imageWidth = 1200,
  imageHeight = 800,
  onSelect,
  scrollerRef,
  registerCard,
}) {
  return (
    <div
      ref={scrollerRef}
      className="relative flex snap-x snap-mandatory gap-5 overflow-x-auto py-2 px-[max(1rem,calc((100%-min(87.5vw,1000px))/2))] scrollbar-none
      [&::-webkit-scrollbar]:hidden"
    >
      {cards.map((card, index) => (
        <div
          key={index}
          ref={registerCard(index)}
          id={`${idPrefix}-card-${index}`}
          role="tabpanel"
          aria-labelledby={`${idPrefix}-dot-${index}`}
          className={`relative flex h-10 w-[min(87.5vw,1000px)] shrink-0 snap-center items-center overflow-hidden rounded-3xl bg-[#F5F3F6] transition-colors duration-200
          *:transition-opacity *:duration-200
          md:h-140
          dark:bg-[#101012]
          ${
            card.imagePosition === "top"
              ? "flex-col-reverse"
              : card.imagePosition === "left"
                ? "flex-row-reverse"
                : card.imagePosition === "right"
                  ? "flex-row"
                  : "flex-col"
          }
          ${
            card.caption
              ? card.imagePosition === "top"
                ? "gap-8 px-6 pb-10 md:pb-14"
                : card.imagePosition === "left"
                  ? "gap-8 pr-6"
                  : card.imagePosition === "right"
                    ? "gap-8 pl-6"
                    : "gap-8 px-6 pt-10 md:pt-14"
              : ""
          }
          ${
            current === index
              ? ""
              : `hover:bg-[#EFEDF0] hover:*:opacity-90
                dark:hover:bg-[#28282B]`
          }`}
        >
          {current !== index && (
            <button
              type="button"
              onClick={() => onSelect(index)}
              className="absolute inset-0 z-10 cursor-pointer rounded-3xl outline-none
              focus-visible:shadow-[0_0_3px_2px_#e5e7eb]
              dark:focus-visible:shadow-[0_0_3px_3px_#28282b]"
            >
              <span className="sr-only">{`Ver tarjeta: ${card.title}`}</span>
            </button>
          )}

          {card.caption && (
            <p
              className={`${
                card.imagePosition === "left" || card.imagePosition === "right"
                  ? "w-[25%]"
                  : "max-w-xl"
              } text-center text-[22px] leading-[1.1428] font-semibold tracking-[0.007em] text-black/90
              md:text-[28px]
              dark:text-[#E4E2E5]`}
            >
              {card.caption}
            </p>
          )}

          {card.image && (
            <img
              {...(card.sharedId && { "data-shared-id": card.sharedId })}
              src={card.image}
              alt={card.alt}
              width={imageWidth}
              height={imageHeight}
              loading={card.sharedId ? "eager" : "lazy"}
              className={
                card.caption
                  ? card.imagePosition === "left" ||
                    card.imagePosition === "right"
                    ? "min-w-0 flex-1 rounded-2xl object-cover"
                    : card.imagePosition === "top"
                      ? "min-h-0 w-full max-w-3xl flex-1 rounded-b-2xl object-cover"
                      : "min-h-0 w-full max-w-3xl flex-1 rounded-t-2xl object-cover"
                  : "h-full w-full rounded-3xl object-cover"
              }
            />
          )}

          {card.video && (
            <video
              ref={(node) => {
                if (!node) return;
                if (current === index) node.play().catch(() => {});
                else node.pause();
              }}
              src={card.video}
              className={
                card.caption
                  ? card.imagePosition === "left" ||
                    card.imagePosition === "right"
                    ? "min-w-0 flex-1 rounded-2xl object-cover"
                    : card.imagePosition === "top"
                      ? "min-h-0 w-full max-w-3xl flex-1 rounded-b-2xl object-cover"
                      : "min-h-0 w-full max-w-3xl flex-1 rounded-t-xl object-cover"
                  : "h-full w-full rounded-3xl object-cover"
              }
            />
          )}
        </div>
      ))}
    </div>
  );
}
