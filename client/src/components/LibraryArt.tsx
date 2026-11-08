import { Icon } from "./Icon";
export function LibraryArt() {
  return (
    <div className="library-art" aria-hidden="true">
      <div className="art-orbit" />
      <div className="art-orbit art-orbit--inner" />
      <div className="art-book art-book--back" />
      <div className="art-book art-book--front">
        <span className="art-book-brand">BOOKFLOW</span>
        <Icon name="book" />
        <span className="art-book-rule" />
        <span className="art-book-bottom">THE READING ROOM</span>
      </div>
      <span className="art-spark art-spark--one">✦</span>
      <span className="art-spark art-spark--two">✧</span>
    </div>
  );
}
