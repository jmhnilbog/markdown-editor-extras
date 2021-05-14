import { suite, test } from "@testdeck/mocha";
import * as _chai from "chai";
// import { mock, instance } from "ts-mockito";

import MarkdownIt from "markdown-it";
import addExtras from "../src/addExtras";

_chai.should();

import fs from "fs";

@suite
export class ExtrasTest {
  //   private SUT: HelloWorldService;
  //   private loggerMock: Logger;

  //   private SUT: HelloWorldService;
  //   private loggerMock: Logger;
  private md!: MarkdownIt;
  private prefix: string = "";
  private suffix: string = "";

  before() {
    this.prefix = fs.readFileSync("./tests/_prefix.html-fragment", "utf8");
    this.suffix = fs.readFileSync("./tests/_suffix.html-fragment", "utf8");

    this.md = new MarkdownIt({
      typographer: true,
    });
  }

  @test "should not blow up"() {
    const ex = addExtras(this.md);

    const testFiles = [
      "chat",
      "creature",
      "fixture",
      "item",
      "location",
      "scene",
      "trap",
    ];

    fs.readFile("./tests/creature.md", "utf-8", (err, data) => {
      if (err) {
        throw err;
      }
      console.log(data);
    });

    const creatureMarkdown = fs.readFileSync("./tests/creature.md").toString();
    // console.log("Loaded:");
    // console.log(creatureMarkdown);
    const rendered = ex.render(creatureMarkdown.toString());
    // console.log(rendered);
    const wrapped = `${this.prefix}${rendered}${this.suffix}`;
    fs.writeFileSync("./samples/creature.html", wrapped);
    return true;
  }
}
