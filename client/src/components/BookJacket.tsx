import { Icon } from "./Icon";
export function BookJacket({
  title,
  author,
  index = 0,
}: {
  title: string;
  author: string;
  index?: number;
}) {
  return (
    <div
      className={`book-jacket book-jacket--${index % 4}`}
      aria-hidden="true"
      data-author={author}
    >
      <span className="jacket-line" />
      <Icon name="book" />
      <span className="jacket-title">
        {title.slice(0, 1).toLocaleUpperCase()}
      </span>
      <span className="jacket-author">BOOKFLOW</span>
    </div>
  );
}
