<style>
	.custom-style {
		font-weight: 700;
	}
</style>

::: custom-style
This should be bold, because of markdown-it-container.
:::

And this should be, because of markdown-it-attrs. {.custom-style}

Everything else in here is from the css present in this module's styles.

# h1

## h2

### h3

#### h4

##### h5

###### h6

::: fake-section

# h1

## h2

### h3

#### h4

##### h5

###### h6

:::

# Header {.red}

::: any-class
I've got some stuff in any-class.
:::

::: withV
Uh....
:::

::: red
What?
:::

Term 1

:   Definition 1

beefy

: This might be a racist term

Here is a footnote reference,[^1] and another.[^longnote]

[^1]: Here is the footnote.

[^longnote]: Here's one with multiple blocks.

    Subsequent paragraphs are indented to show that they
belong to the previous footnote.

Here is an inline note.^[Inlines notes are easier to write, since
you don't have to pick an identifier and move down to type the
note.]

::: red
I'm in the block
:::

I'm out.

:::: aside

::: hidden
This stuff is only conditionally revealed.
:::

::::